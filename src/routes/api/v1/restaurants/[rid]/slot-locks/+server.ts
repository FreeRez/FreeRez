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
		party_size: number;
		date_time: string;
		reservation_attribute?: string;
		experience?: {
			id: number;
			version: number;
			party_size_per_price_type?: Array<{ id: number; count: number }>;
			add_ons?: Array<{ item_id: string; quantity: number }>;
		};
		dining_area_id?: number;
		environment?: string;
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
	const expiresAtDate = new Date(Date.now() + 5 * 60 * 1000);
	// Format as YYYY-MM-DDTHH:MM:SS (no timezone) to match OpenTable
	const expiresAt = expiresAtDate.toISOString().replace(/\.\d{3}Z$/, '');

	await db.insert(slotLocks).values({
		restaurantId: restaurant.id,
		reservationToken,
		partySize: body.party_size,
		dateTime: body.date_time,
		reservationAttribute: body.reservation_attribute ?? 'default',
		diningAreaId: body.dining_area_id ?? null,
		environment: body.environment ?? null,
		experienceData: body.experience ? JSON.stringify(body.experience) : null,
		expiresAt: expiresAtDate.toISOString()
	});

	return apiSuccess({
		expires_at: expiresAt,
		reservation_token: reservationToken
	});
};
