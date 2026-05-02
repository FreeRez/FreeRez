declare global {
	namespace App {
		interface Error {
			message: string;
			code?: string;
		}
		interface Locals {
			adapter: import('$lib/server/db/adapters').DatabaseAdapter;
			db: import('$db').Database;
			cpDb: import('./lib/server/control-plane').ControlPlaneDatabase;
			webhookAdapter: import('$lib/server/webhooks/types').WebhookDeliveryAdapter | null;
			notifications: import('$lib/server/notifications/types').NotificationService;
			tenantId: string;
			tenant: import('./lib/server/control-plane/resolve').ResolvedTenant | null;
			user: import('$lib/server/auth').SessionUser | null;
			session: import('$lib/server/auth').Session | null;
		}
		interface Platform {
			env: {
				DB: D1Database;
				CONTROL_PLANE_DB: D1Database;
				TENANT_DBS: Record<string, D1Database>;
				ADMIN_API_KEY: string;
				PUBLIC_APP_NAME: string;
				RATE_LIMITER?: { limit: (opts: { key: string }) => Promise<{ success: boolean }> };
				WEBHOOK_DO?: DurableObjectNamespace;
				CF_EMAIL_TOKEN?: string;
				CF_ACCOUNT_ID?: string;
				EMAIL_API_URL?: string;
				EMAIL_API_KEY?: string;
				EMAIL_FROM?: string;
				SMTP_HOST?: string;
				SMTP_PORT?: string;
				SMTP_USER?: string;
				SMTP_PASS?: string;
				TWILIO_ACCOUNT_SID?: string;
				TWILIO_AUTH_TOKEN?: string;
				TWILIO_API_KEY_SID?: string;
				TWILIO_API_KEY_SECRET?: string;
				TWILIO_FROM_NUMBER?: string;
				SMS_API_URL?: string;
				SMS_API_KEY?: string;
				SMS_FROM_NUMBER?: string;
				GMB_CLIENT_ID?: string;
				GMB_CLIENT_SECRET?: string;
				GMB_REDIRECT_URI?: string;
				GMB_PUBSUB_VERIFICATION_TOKEN?: string;
				BETTER_AUTH_SECRET?: string;
				BETTER_AUTH_URL?: string;
			};
			context: ExecutionContext;
			caches: CacheStorage & { default: Cache };
		}
	}
}

export {};
