import type { RequestHandler } from './$types';
import { apiError, apiSuccess, requireIntegrationRestaurant } from '$api/helpers';
import { schema } from '$db';
import { eq } from 'drizzle-orm';
import { getProviderConfig, resolveCredentials } from '$lib/server/integrations/registry';
import { ensureValidToken } from '$lib/server/integrations/token-manager';
import { syncReviews } from '$lib/server/integrations/google-my-business/review-sync';

export const POST: RequestHandler = async (event) => {
	const result = await requireIntegrationRestaurant(event, 'google-my-business');
	if (result instanceof Response) return result;
	const { restaurant, integration } = result;

	const db = event.locals.db;
	const config = getProviderConfig('google-my-business')!;
	const env = (event.platform?.env ?? {}) as Record<string, string | undefined>;
	const credentials = resolveCredentials(config, env);
	if (!credentials) return apiError('Integration not configured', 503);

	const integ = integration as typeof schema.partnerIntegrations.$inferSelect;
	const accessToken = await ensureValidToken(db, integ, config, credentials);
	const locationName = integ.partnerIdentifier;
	if (!locationName) return apiError('No location linked', 400);

	const syncResult = await syncReviews(db, accessToken, locationName, restaurant.id, restaurant.rid);

	await db
		.update(schema.partnerIntegrations)
		.set({
			metadata: {
				...(integ.metadata as Record<string, unknown> ?? {}),
				lastReviewSyncAt: new Date().toISOString(),
			},
			updatedAt: new Date().toISOString(),
		})
		.where(eq(schema.partnerIntegrations.id, integ.id));

	return apiSuccess(syncResult);
};
