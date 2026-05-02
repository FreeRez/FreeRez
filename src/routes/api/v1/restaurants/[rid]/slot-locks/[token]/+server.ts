import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { restaurants, slotLocks } from '$db/schema';
import { getAuthContext, apiError, apiSuccess, requireAuthorizedRid } from '$api/helpers';

export const DELETE: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;
	const auth = getAuthContext(event)!;

	const reservationToken = event.params.token;
	if (!reservationToken) return apiError('token is required', 400);

	const db = event.locals.db;

	// Resolve restaurant
	const rest = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);

	if (rest.length === 0) return apiError('Restaurant not found', 404);
	const restaurant = rest[0];

	// Find and delete the slot lock
	const locks = await db
		.select()
		.from(slotLocks)
		.where(
			and(
				eq(slotLocks.restaurantId, restaurant.id),
				eq(slotLocks.reservationToken, reservationToken)
			)
		)
		.limit(1);

	if (locks.length === 0) return apiError('Slot lock not found', 404);

	await db
		.delete(slotLocks)
		.where(eq(slotLocks.reservationToken, reservationToken));

	return apiSuccess({ status: 'Success' });
};
