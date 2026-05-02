import type { RequestHandler } from './$types';
import { apiError, apiSuccess, requireIntegrationRestaurant } from '$api/helpers';
import { schema } from '$db';
import { eq } from 'drizzle-orm';
import { getProviderConfig, resolveCredentials } from '$lib/server/integrations/registry';
import { ensureValidToken } from '$lib/server/integrations/token-manager';
import { getLocationHours } from '$lib/server/integrations/google-my-business/client';
import { compareHours } from '$lib/server/integrations/google-my-business/hours-sync';
import { restaurants } from '$db/schema';
import type { FreerezOpeningTimes } from '$lib/server/integrations/google-my-business/types';

export const GET: RequestHandler = async (event) => {
	const result = await requireIntegrationRestaurant(event, 'google-my-business');
	if (result instanceof Response) return result;
	const { restaurant, integration } = result;

	const db = event.locals.db;

	const rest = await db
		.select()
		.from(restaurants)
		.where(eq(restaurants.id, restaurant.id))
		.limit(1);

	if (rest.length === 0) return apiError('Restaurant not found', 404);

	const config = getProviderConfig('google-my-business')!;
	const env = (event.platform?.env ?? {}) as Record<string, string | undefined>;
	const credentials = resolveCredentials(config, env);
	if (!credentials) return apiError('Integration not configured', 503);

	const integ = integration as typeof schema.partnerIntegrations.$inferSelect;
	const accessToken = await ensureValidToken(db, integ, config, credentials);
	const locationName = integ.partnerIdentifier;
	if (!locationName) return apiError('No location linked', 400);

	const googleHours = await getLocationHours(accessToken, locationName);
	const freerezHours = rest[0].openingTimes as FreerezOpeningTimes | null;

	const comparison = compareHours(freerezHours, googleHours);

	return apiSuccess(comparison);
};
