import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { restaurants, posRestaurants } from '$db/schema';
import { getAuthContext, apiError, apiSuccess, requireAuthorizedRid, parseJsonBody } from '$api/helpers';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;
	const auth = getAuthContext(event)!;

	const db = event.locals.db;

	// Resolve restaurant
	const rest = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);

	if (rest.length === 0) return apiError('Restaurant not found', 404);
	const restaurant = rest[0];

	const posRecord = await db
		.select()
		.from(posRestaurants)
		.where(eq(posRestaurants.restaurantId, restaurant.id))
		.limit(1);

	if (posRecord.length === 0) return apiError('POS restaurant not found', 404);

	const r = posRecord[0];

	return apiSuccess({
		rid: r.rid,
		restaurant_name: r.restaurantName,
		source_location_id: r.sourceLocationId,
		pos_type: r.posType,
		status: r.status,
		source_location_status: r.sourceLocationStatus,
		datetime_of_first_check: r.datetimeOfFirstCheck,
		datetime_of_last_check: r.datetimeOfLastCheck
	});
};

interface PosStatusBody {
	partner: {
		status: string;
		cancel_reason?: string;
		date_modified_utc?: string;
	};
	system_clock_time?: string;
}

export const PATCH: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;
	const auth = getAuthContext(event)!;

	const db = event.locals.db;

	const parsed = await parseJsonBody<PosStatusBody>(event);
	if ('error' in parsed) return parsed.error;
	const body = parsed.data;

	if (!body.partner?.status) {
		return apiError('partner.status is required', 400);
	}

	// Resolve restaurant
	const rest = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);

	if (rest.length === 0) return apiError('Restaurant not found', 404);
	const restaurant = rest[0];

	// Find existing POS restaurant record
	const existing = await db
		.select()
		.from(posRestaurants)
		.where(eq(posRestaurants.restaurantId, restaurant.id))
		.limit(1);

	if (existing.length === 0) return apiError('POS restaurant not found', 404);

	const isOnline = body.partner.status === 'online' || body.partner.status === 'enabled';
	const newStatus = isOnline ? 'enabled' : 'disabled';
	const newLocationStatus = isOnline ? 'online' : 'offline';

	await db
		.update(posRestaurants)
		.set({
			status: newStatus as 'enabled' | 'disabled',
			sourceLocationStatus: newLocationStatus as 'online' | 'offline',
			datetimeOfLastCheck: body.system_clock_time ?? new Date().toISOString(),
			updatedAt: new Date().toISOString()
		})
		.where(eq(posRestaurants.restaurantId, restaurant.id));

	return json(null, { status: 200 });
};
