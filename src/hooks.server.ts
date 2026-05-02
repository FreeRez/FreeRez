import type { Handle } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { createAdapter, type DatabaseAdapter } from '$lib/server/db/adapters';
import { resolveTokenToTenant } from '$lib/server/control-plane/resolve';
import { createAuth } from '$lib/server/auth';
import { CloudflareWebhookAdapter } from '$lib/server/webhooks/adapter-cloudflare';
import { LocalWebhookAdapter } from '$lib/server/webhooks/adapter-local';
import type { WebhookDeliveryAdapter } from '$lib/server/webhooks/types';
import { checkIdempotency, storeIdempotency } from '$lib/server/api/idempotency';
import { log } from '$lib/server/logger';
import { HttpEmailAdapter, SmtpEmailAdapter } from '$lib/server/notifications/adapters/smtp-email';
import { CloudflareEmailAdapter } from '$lib/server/notifications/adapters/cloudflare-email';
import { TwilioSmsAdapter } from '$lib/server/notifications/adapters/twilio-sms';
import { HttpSmsAdapter } from '$lib/server/notifications/adapters/http-sms';
import type { NotificationService } from '$lib/server/notifications/types';

const ALLOWED_ORIGINS = ['*'];
const MAX_BODY_SIZE = 1024 * 1024; // 1MB

export const handle: Handle = async ({ event, resolve }) => {
	// ─── CORS Preflight ──────────────────────────────────────────────────
	if (event.request.method === 'OPTIONS') {
		return new Response(null, {
			status: 204,
			headers: corsHeaders(event.request.headers.get('Origin'))
		});
	}

	// ─── Body Size Check ─────────────────────────────────────────────────
	const contentLength = event.request.headers.get('Content-Length');
	if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
		return json(
			{ errors: [{ message: 'Request body too large' }], requestid: crypto.randomUUID() },
			{ status: 413 }
		);
	}

	// ─── Database Adapter ────────────────────────────────────────────────
	const platform = event.platform as App.Platform | undefined;
	const hasCloudflare = !!platform?.env?.DB;

	let adapter: DatabaseAdapter | null = null;
	let cpDb: import('$lib/server/control-plane').ControlPlaneDatabase | null = null;
	let defaultDb: import('$db').Database | null = null;

	if (hasCloudflare) {
		const env = platform!.env;
		adapter = createAdapter({
			type: 'cloudflare',
			env: {
				DB: env.DB,
				CONTROL_PLANE_DB: env.CONTROL_PLANE_DB,
				TENANT_DBS: env.TENANT_DBS
			}
		});
		cpDb = adapter.getControlPlaneDb();
		defaultDb = adapter.getDefaultDb();
	}

	// ─── Webhook Adapter ─────────────────────────────────────────────────
	let webhookAdapter: WebhookDeliveryAdapter | null = null;
	if (hasCloudflare) {
		const env = platform!.env;
		if (env.WEBHOOK_DO) {
			webhookAdapter = new CloudflareWebhookAdapter(env.WEBHOOK_DO);
		} else {
			webhookAdapter = new LocalWebhookAdapter();
		}
	}

	// ─── Notification Adapters ───────────────────────────────────────────
	const notifications: NotificationService = { email: null, sms: null };

	if (hasCloudflare) {
		const envRecord = platform!.env as unknown as Record<string, string | undefined>;

		if (envRecord.CF_ACCOUNT_ID && envRecord.CF_EMAIL_TOKEN) {
			notifications.email = new CloudflareEmailAdapter(
				envRecord.CF_ACCOUNT_ID,
				envRecord.CF_EMAIL_TOKEN,
				envRecord.EMAIL_FROM ?? 'noreply@freerez.com'
			);
		} else if (envRecord.SMTP_HOST && envRecord.SMTP_USER) {
			notifications.email = new SmtpEmailAdapter(
				envRecord.SMTP_HOST,
				parseInt(envRecord.SMTP_PORT ?? '587', 10),
				envRecord.SMTP_USER,
				envRecord.SMTP_PASS ?? '',
				envRecord.EMAIL_FROM ?? 'noreply@freerez.com'
			);
		} else if (envRecord.EMAIL_API_URL && envRecord.EMAIL_API_KEY) {
			notifications.email = new HttpEmailAdapter(
				envRecord.EMAIL_API_URL,
				envRecord.EMAIL_API_KEY,
				envRecord.EMAIL_FROM ?? 'noreply@freerez.com'
			);
		}

		if (envRecord.TWILIO_ACCOUNT_SID && envRecord.TWILIO_FROM_NUMBER) {
			notifications.sms = new TwilioSmsAdapter({
				accountSid: envRecord.TWILIO_ACCOUNT_SID,
				authToken: envRecord.TWILIO_AUTH_TOKEN,
				apiKeySid: envRecord.TWILIO_API_KEY_SID,
				apiKeySecret: envRecord.TWILIO_API_KEY_SECRET,
				fromNumber: envRecord.TWILIO_FROM_NUMBER
			});
		} else if (envRecord.SMS_API_URL && envRecord.SMS_API_KEY) {
			notifications.sms = new HttpSmsAdapter(
				envRecord.SMS_API_URL,
				envRecord.SMS_API_KEY,
				envRecord.SMS_FROM_NUMBER ?? ''
			);
		}
	}

	event.locals.adapter = adapter as import('$lib/server/db/adapters').DatabaseAdapter;
	event.locals.cpDb = cpDb as import('$lib/server/control-plane').ControlPlaneDatabase;
	event.locals.db = defaultDb as import('$db').Database;
	event.locals.webhookAdapter = webhookAdapter;
	event.locals.notifications = notifications;
	event.locals.tenantId = 'default';
	event.locals.tenant = null;
	event.locals.user = null;
	event.locals.session = null;

	// ─── Route Classification ────────────────────────────────────────────
	const path = event.url.pathname;
	const isIntegrationOAuthRoute =
		path.startsWith('/api/v1/integrations/') &&
		(path.includes('/connect') || path.includes('/callback') || path.includes('/disconnect'));

	const isApiRoute =
		!isIntegrationOAuthRoute && (
			path.startsWith('/api/v1/restaurants') ||
			path.startsWith('/api/v1/oauth') ||
			path.startsWith('/api/v1/admin') ||
			path.startsWith('/api/v1/mcp') ||
			path.startsWith('/api/v1/health') ||
			path.startsWith('/api/v1/integrations')
		);

	if (isApiRoute && hasCloudflare && cpDb && adapter) {
		const authHeader = event.request.headers.get('Authorization');

		if (authHeader?.startsWith('Bearer ')) {
			const token = authHeader.slice(7);
			const tenant = await resolveTokenToTenant(cpDb, token);

			if (tenant) {
				event.locals.tenant = tenant;
				event.locals.tenantId = tenant.tenantId;
				event.locals.db = adapter.getTenantDb(tenant.d1DatabaseId);

				const rateLimiter = platform!.env.RATE_LIMITER;
				if (rateLimiter) {
					const result = await rateLimiter.limit({ key: tenant.clientId });
					if (!result.success) {
						return json(
							{ errors: [{ message: 'Rate limit exceeded' }], requestid: crypto.randomUUID() },
							{
								status: 429,
								headers: { 'Retry-After': '60' }
							}
						);
					}
				}
			}
		}
	} else if ((!path.startsWith('/api/') || isIntegrationOAuthRoute) && defaultDb) {
		try {
			const envRecord = (platform?.env ?? {}) as Record<string, string | undefined>;
			const auth = createAuth(defaultDb, {
				baseURL: event.url.origin,
				secret: envRecord.BETTER_AUTH_SECRET,
				emailAdapter: notifications.email,
			});
			const sessionResult = await auth.api.getSession({
				headers: event.request.headers
			});

			if (sessionResult) {
				event.locals.user = {
					id: sessionResult.user.id,
					name: sessionResult.user.name,
					email: sessionResult.user.email,
					role:
						((sessionResult.user as Record<string, unknown>).role as string) ?? 'owner',
					image: sessionResult.user.image
				};
				event.locals.session = {
					id: sessionResult.session.id,
					userId: sessionResult.session.userId,
					token: sessionResult.session.token,
					expiresAt: sessionResult.session.expiresAt.toISOString()
				};
			}
		} catch {
			// session auth failed
		}
	}

	// ─── Idempotency Check ───────────────────────────────────────────────
	const requestId = event.request.headers.get('X-Request-Id');
	const method = event.request.method;
	const isMutating = ['POST', 'PUT', 'PATCH'].includes(method);

	if (isMutating && requestId && event.locals.tenant && isApiRoute && cpDb) {
		const cached = await checkIdempotency(
			cpDb!,
			event.locals.tenant.clientId,
			requestId
		);
		if (cached.hit) {
			log('info', 'idempotency.hit', { requestId, clientId: event.locals.tenant.clientId });
			return new Response(cached.body, {
				status: cached.statusCode,
				headers: { 'Content-Type': 'application/json', 'X-Idempotent-Replay': 'true' }
			});
		}
	}

	// ─── Resolve ─────────────────────────────────────────────────────────
	const response = await resolve(event);

	// ─── Idempotency Store ───────────────────────────────────────────────
	if (isMutating && requestId && event.locals.tenant && isApiRoute && response.ok && cpDb) {
		const cloned = response.clone();
		const body = await cloned.text();
		try {
			await storeIdempotency(
				cpDb!,
				event.locals.tenant.clientId,
				requestId,
				method,
				path,
				response.status,
				body
			);
		} catch {
			// idempotency store failed — non-fatal
		}
	}

	// ─── Security Headers ────────────────────────────────────────────────
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-XSS-Protection', '1; mode=block');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	response.headers.set(
		'Strict-Transport-Security',
		'max-age=31536000; includeSubDomains'
	);

	if (!path.startsWith('/api/')) {
		response.headers.set(
			'Content-Security-Policy',
			"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com"
		);
	}

	// ─── CORS Headers ────────────────────────────────────────────────────
	const origin = event.request.headers.get('Origin');
	if (origin && path.startsWith('/api/')) {
		const headers = corsHeaders(origin);
		for (const [key, value] of Object.entries(headers)) {
			response.headers.set(key, value);
		}
	}

	return response;
};

function corsHeaders(origin: string | null): Record<string, string> {
	const allowOrigin =
		ALLOWED_ORIGINS.includes('*') ? '*' : (origin && ALLOWED_ORIGINS.includes(origin) ? origin : '');

	if (!allowOrigin) return {};

	return {
		'Access-Control-Allow-Origin': allowOrigin,
		'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
		'Access-Control-Allow-Headers':
			'Authorization, Content-Type, X-Request-Id, X-Admin-Key',
		'Access-Control-Max-Age': '86400',
		'Access-Control-Expose-Headers': 'X-Request-Id'
	};
}
