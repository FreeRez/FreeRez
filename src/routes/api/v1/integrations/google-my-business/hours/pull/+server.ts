import type { RequestHandler } from './$types';
import { apiError, apiSuccess, requireIntegrationRestaurant } from '$api/helpers';
import { schema } from '$db';
import { eq } from 'drizzle-orm';
import { getProviderConfig, resolveCredentials } from '$lib/server/integrations/registry';
import { ensureValidToken } from '$lib/server/integrations/token-manager';
import { getLocationHours } from '$lib/server/integrations/google-my-business/client';
import { convertToFreerezFormat } from '$lib/server/integrations/google-my-business/hours-sync';
import { restaurants } from '$db/schema';
import { log } from '$lib/server/logger';

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

	const googleHours = await getLocationHours(accessToken, locationName);
	if (!googleHours) return apiError('No hours found on Google listing', 404);

	const freerezHours = convertToFreerezFormat(googleHours);

	await db
		.update(restaurants)
		.set({
			openingTimes: freerezHours,
			updatedAt: new Date().toISOString(),
		})
		.where(eq(restaurants.id, restaurant.id));

	log('info', 'gmb.hours.pulled', { restaurantId: restaurant.id, rid: restaurant.rid });

	return apiSuccess({ pulled: true, hours: freerezHours });
};
