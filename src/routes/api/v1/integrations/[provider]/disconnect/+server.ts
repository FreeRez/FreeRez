import type { RequestHandler } from './$types';
import { getProviderConfig } from '$lib/server/integrations/registry';
import { revokeToken } from '$lib/server/integrations/oauth-flow';
import { apiError, apiSuccess } from '$api/helpers';
import { schema } from '$db';
import { eq, and } from 'drizzle-orm';
import { log } from '$lib/server/logger';

export const POST: RequestHandler = async (event) => {
	const providerId = event.params.provider;
	if (!providerId) return apiError('Provider is required', 400);

	const config = getProviderConfig(providerId);
	if (!config) return apiError('Unknown provider', 404);

	const db = event.locals.db;
	if (!db) return apiError('Database unavailable', 503);

	const body = await event.request.json().catch(() => ({})) as { restaurantId?: string };
	const restaurantId = body.restaurantId;
	if (!restaurantId) return apiError('restaurantId is required', 400);

	const integration = await db
		.select()
		.from(schema.partnerIntegrations)
		.where(
			and(
				eq(schema.partnerIntegrations.restaurantId, restaurantId),
				eq(schema.partnerIntegrations.partnerId, providerId)
			)
		)
		.limit(1);

	if (integration.length === 0) {
		return apiError('Integration not found', 404);
	}

	if (integration[0].accessToken) {
		await revokeToken(config, integration[0].accessToken).catch(() => {});
	}

	await db
		.update(schema.partnerIntegrations)
		.set({
			accessToken: null,
			refreshToken: null,
			tokenExpiresAt: null,
			partnerIdentifier: null,
			status: 'inactive',
			metadata: null,
			updatedAt: new Date().toISOString(),
		})
		.where(eq(schema.partnerIntegrations.id, integration[0].id));

	log('info', 'integration.disconnected', { providerId, restaurantId });

	return apiSuccess({ disconnected: true });
};
