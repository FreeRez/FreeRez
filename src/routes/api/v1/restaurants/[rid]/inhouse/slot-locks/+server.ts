import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { restaurants, slotLocks } from '$db/schema';
import { getAuthContext, apiError, apiSuccess, requireAuthorizedRid, parseJsonBody } from '$api/helpers';

export const POST: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;
	const auth = getAuthContext(event)!;

	const db = event.locals.db;

	const parsed = await parseJsonBody<{
		restaurant_id?: number;
		party_size: number;
		date_time: string;
		table_type?: string;
		dining_area_id?: number;
	}>(event);
	if ('error' in parsed) return parsed.error;
	const body = parsed.data;

	if (!body.party_size || !body.date_time) {
		return apiError('party_size and date_time are required', 400);
	}

	// Resolve restaurant
	const rest = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);

	if (rest.length === 0) return apiError('Restaurant not found', 404);
	const restaurant = rest[0];

	// Generate reservation token and expiry (5 minutes)
	const reservationToken = crypto.randomUUID();
	const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

	await db.insert(slotLocks).values({
		restaurantId: restaurant.id,
		reservationToken,
		partySize: body.party_size,
		dateTime: body.date_time,
		reservationAttribute: body.table_type ?? 'default',
		diningAreaId: body.dining_area_id ?? null,
		expiresAt
	});

	return apiSuccess({
		expires_at: expiresAt,
		reservation_token: reservationToken
	});
};
