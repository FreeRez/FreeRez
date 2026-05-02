import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { guests, restaurants } from '$db/schema';
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

	const parsed = await parseJsonBody<{ url?: string }>(event);
	if ('error' in parsed) return parsed.error;
	const body = parsed.data;

	if (!body.url) {
		return apiError("'url' cannot be null or empty", 400);
	}

	await db
		.update(guests)
		.set({
			photoUrl: body.url,
			photoStatus: 'PENDING',
			updatedAt: new Date().toISOString(),
			updatedAtUtc: new Date().toISOString()
		})
		.where(eq(guests.id, guestId));

	return new Response(null, { status: 202 });
};

export const DELETE: RequestHandler = async (event) => {
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

	await db
		.update(guests)
		.set({
			photoUrl: null,
			photoStatus: null,
			updatedAt: new Date().toISOString(),
			updatedAtUtc: new Date().toISOString()
		})
		.where(eq(guests.id, guestId));

	return new Response(null, { status: 202 });
};

export const GET: RequestHandler = async (event) => {
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

	return apiSuccess({
		status: guest[0].photoStatus ?? null,
		updatedAt: guest[0].updatedAt ?? null
	});
};
