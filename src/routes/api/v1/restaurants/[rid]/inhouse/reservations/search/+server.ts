import type { RequestHandler } from './$types';
import { eq, and, like, sql } from 'drizzle-orm';
import { restaurants, reservations, guests } from '$db/schema';
import { getAuthContext, apiError, apiSuccess, requireAuthorizedRid, parseJsonBody } from '$api/helpers';

export const POST: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;
	const auth = getAuthContext(event)!;

	const db = event.locals.db;

	const parsed = await parseJsonBody<{
		phone_number: {
			number: string;
			country_code?: number;
		};
	}>(event);
	if ('error' in parsed) return parsed.error;
	const body = parsed.data;

	if (!body.phone_number?.number) {
		return apiError('phone_number.number is required', 400);
	}

	// Resolve restaurant
	const rest = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);

	if (rest.length === 0) return apiError('Restaurant not found', 404);
	const restaurant = rest[0];

	// Strip non-digits for matching
	const phoneDigits = body.phone_number.number.replace(/\D/g, '');

	// Find guests by phone number
	const matchingGuests = await db
		.select()
		.from(guests)
		.where(
			and(
				eq(guests.restaurantId, restaurant.id),
				like(guests.phone, `%${phoneDigits}%`)
			)
		);

	if (matchingGuests.length === 0) {
		return apiSuccess({ reservations: [] });
	}

	const guestIds = matchingGuests.map((g) => g.id);

	// Get reservations for these guests (active, non-cancelled)
	const allReservations: Array<{
		special_request: string;
		confirmation_number: number;
		reservation_id: string;
		restaurant_id: number;
		date_time: string;
		party_size: number;
		status: string;
	}> = [];

	for (const gId of guestIds) {
		const guestReservations = await db
			.select()
			.from(reservations)
			.where(
				and(
					eq(reservations.restaurantId, restaurant.id),
					eq(reservations.guestId, gId),
					sql`${reservations.state} NOT IN ('Cancelled', 'CancelledWeb', 'NoShow')`
				)
			);

		for (const res of guestReservations) {
			// Map internal state to spec status
			const status = res.state === 'Confirmed' || res.state === 'Pending' ? 'Modifiable' : res.state;

			allReservations.push({
				special_request: res.guestRequest ?? '',
				confirmation_number: res.confirmationId,
				reservation_id: res.id,
				restaurant_id: rid,
				date_time: res.scheduledTime,
				party_size: res.partySize,
				status
			});
		}
	}

	return apiSuccess({ reservations: allReservations });
};
