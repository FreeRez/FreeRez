import type { RequestHandler } from './$types';
import { redirect } from '@sveltejs/kit';
import { getProviderConfig, resolveCredentialsFromDb } from '$lib/server/integrations/registry';
import { buildAuthorizeUrl, computeRedirectUri } from '$lib/server/integrations/oauth-flow';
import { apiError } from '$api/helpers';
import { schema } from '$db';
import { eq, and } from 'drizzle-orm';

export const GET: RequestHandler = async (event) => {
	const providerId = event.params.provider;
	if (!providerId) return apiError('Provider is required', 400);

	const config = getProviderConfig(providerId);
	if (!config) return apiError('Unknown provider', 404);

	const returnUrl = event.url.searchParams.get('returnUrl') ?? '/dashboard/settings';

	const db = event.locals.db;
	if (!db) return redirect(302, `${returnUrl}?error=unavailable`);

	const user = event.locals.user;
	const userId = user?.id ?? 'anonymous';

	const restaurantId = event.url.searchParams.get('restaurantId');
	if (!restaurantId) return apiError('restaurantId is required', 400);

	// Check for existing integration (may have per-tenant credentials in metadata)
	const existing = await db
		.select()
		.from(schema.partnerIntegrations)
		.where(
			and(
				eq(schema.partnerIntegrations.restaurantId, restaurantId),
				eq(schema.partnerIntegrations.partnerId, providerId)
			)
		)
		.limit(1);

	const existingMetadata = existing[0]?.metadata as Record<string, unknown> | null;

	const env = (event.platform?.env ?? {}) as Record<string, string | undefined>;
	const credentials = await resolveCredentialsFromDb(config, event.locals.cpDb, env, existingMetadata);

	if (!credentials) {
		return redirect(302, `${returnUrl}?error=not_configured&provider=${providerId}`);
	}

	const nonce = crypto.randomUUID();

	if (existing.length > 0) {
		await db
			.update(schema.partnerIntegrations)
			.set({
				status: 'pending',
				metadata: { ...existingMetadata, nonce } as Record<string, unknown>,
				updatedAt: new Date().toISOString(),
			})
			.where(eq(schema.partnerIntegrations.id, existing[0].id));
	} else {
		await db.insert(schema.partnerIntegrations).values({
			restaurantId,
			partnerId: providerId,
			status: 'pending',
			metadata: { nonce } as Record<string, unknown>,
		});
	}

	const redirectUri =
		env.GMB_REDIRECT_URI ?? computeRedirectUri(event.url.origin, providerId);

	const authorizeUrl = buildAuthorizeUrl(config, credentials, redirectUri, {
		restaurantId,
		providerId,
		userId,
		nonce,
		returnUrl,
	});

	return redirect(302, authorizeUrl);
};
