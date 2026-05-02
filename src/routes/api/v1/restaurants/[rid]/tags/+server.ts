import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { guestTagDefinitions, restaurants } from '$db/schema';
import { apiError, apiSuccess, getAuthContext, requireAuthorizedRid } from '$api/helpers';

export const GET: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const ridNum = ridResult;
	const auth = getAuthContext(event)!;

	const db = event.locals.db;

	const restaurant = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, ridNum), eq(restaurants.active, true)))
		.limit(1);

	if (restaurant.length === 0) {
		return apiError('Restaurant not found', 404);
	}

	const tags = await db
		.select()
		.from(guestTagDefinitions)
		.where(eq(guestTagDefinitions.restaurantId, restaurant[0].id));

	const items = tags.map((t) => ({
		id: t.tagId,
		displayName: t.displayName,
		category: t.category
	}));

	return apiSuccess(items);
};
