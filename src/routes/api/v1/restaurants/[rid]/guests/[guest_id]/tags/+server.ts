import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { guests, guestTagAssignments, restaurants } from '$db/schema';
import { apiError, apiSuccess, getAuthContext, requireAuthorizedRid, parseJsonBody } from '$api/helpers';

export const PUT: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const ridNum = ridResult;
	const auth = getAuthContext(event)!;

	const guestId = event.params.guest_id;
	if (!guestId) return apiError('guest_id is required', 400);

	const db = event.locals.db;

	const restaurant = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, ridNum), eq(restaurants.active, true)))
		.limit(1);

	if (restaurant.length === 0) {
		return apiError('Restaurant not found', 404);
	}

	const guest = await db
		.select()
		.from(guests)
		.where(and(eq(guests.id, guestId), eq(guests.restaurantId, restaurant[0].id)))
		.limit(1);

	if (guest.length === 0) {
		return apiError('Guest not found', 404);
	}

	const parsed = await parseJsonBody<{ tags?: string[] }>(event);
	if ('error' in parsed) return parsed.error;
	const body = parsed.data;

	if (!body.tags || !Array.isArray(body.tags)) {
		return apiError('tags array is required', 400);
	}

	// Delete existing tag assignments for this guest
	await db.delete(guestTagAssignments).where(eq(guestTagAssignments.guestId, guestId));

	// Insert new tag assignments
	for (const tagId of body.tags) {
		await db.insert(guestTagAssignments).values({
			guestId,
			tagId,
			createdAt: new Date().toISOString()
		});
	}

	return apiSuccess({ tags: body.tags });
};
