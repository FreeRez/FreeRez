import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { restaurants, reservations, slotLocks, guests } from '$db/schema';
import { getAuthContext, apiError, apiSuccess, requireAuthorizedRid, parseJsonBody } from '$api/helpers';
import { dispatchWebhook } from '$api/webhook-dispatcher';
import { notifyReservationConfirmed } from '$lib/server/notifications/dispatcher';
import type { ReservationContext } from '$lib/server/notifications/types';

export const POST: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;
	const auth = getAuthContext(event)!;

	const db = event.locals.db;

	const parsed = await parseJsonBody<{
		first_name: string;
		last_name: string;
		phone?: string | {
			number: string;
			country_code: number;
		};
		email?: string;
		restaurant_id?: string;
		special_request?: string;
		guest_request?: string;
		reservation_token: string;
		sms_notifications_opt_in?: boolean;
		table_type?: string;
		dining_area_id?: number;
		server?: string;
		visit_tags?: string[];
		payments?: {
			waive: boolean;
			waive_reason?: string;
		};
	}>(event);
	if ('error' in parsed) return parsed.error;
	const body = parsed.data;

	if (!body.reservation_token || !body.first_name || !body.last_name) {
		return apiError('reservation_token, first_name, and last_name are required', 400);
	}

	// Resolve restaurant
	const rest = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);

	if (rest.length === 0) return apiError('Restaurant not found', 404);
	const restaurant = rest[0];

	// Validate slot lock
	const locks = await db
		.select()
		.from(slotLocks)
		.where(
			and(
				eq(slotLocks.restaurantId, restaurant.id),
				eq(slotLocks.reservationToken, body.reservation_token)
			)
		)
		.limit(1);

	if (locks.length === 0) return apiError('Invalid or expired reservation token', 400);
	const lock = locks[0];

	if (new Date(lock.expiresAt) < new Date()) {
		await db.delete(slotLocks).where(eq(slotLocks.id, lock.id));
		return apiError('Reservation token has expired', 410);
	}

	const phoneStr = typeof body.phone === 'string' ? body.phone : body.phone?.number ?? null;

	let guestId: string | null = null;
	if (phoneStr || body.email || (body.first_name && body.last_name)) {
		const lookupField = phoneStr ? eq(guests.phone, phoneStr) : body.email ? eq(guests.email, body.email) : null;
		const existingGuests = lookupField ? await db
			.select()
			.from(guests)
			.where(
				and(
					eq(guests.restaurantId, restaurant.id),
					lookupField
				)
			)
			.limit(1) : [];

		if (existingGuests.length > 0) {
			guestId = existingGuests[0].id;
			await db
				.update(guests)
				.set({
					firstName: body.first_name,
					lastName: body.last_name,
					smsOptIn: body.sms_notifications_opt_in ?? existingGuests[0].smsOptIn,
					updatedAt: new Date().toISOString()
				})
				.where(eq(guests.id, guestId));
		} else {
			const newGuest = await db
				.insert(guests)
				.values({
					restaurantId: restaurant.id,
					rid,
					firstName: body.first_name,
					lastName: body.last_name,
					email: body.email ?? null,
					phone: phoneStr,
					smsOptIn: body.sms_notifications_opt_in ?? false
				})
				.returning();
			guestId = newGuest[0].id;
		}
	}

	// Create reservation
	const confirmationId = Math.floor(Math.random() * 2147483647);
	const now = new Date().toISOString();

	const newReservation = await db
		.insert(reservations)
		.values({
			restaurantId: restaurant.id,
			rid,
			guestId,
			confirmationId,
			state: 'Confirmed',
			partySize: lock.partySize,
			scheduledTime: lock.dateTime,
			scheduledTimeUtc: lock.dateTime,
			reservationAttribute: body.table_type ?? lock.reservationAttribute ?? 'default',
			origin: 'Phone/In-house',
			guestRequest: body.special_request ?? body.guest_request ?? null,
			diningAreaId: body.dining_area_id ?? lock.diningAreaId ?? null,
			server: body.server ?? null,
			visitTags: body.visit_tags ?? null,
			smsNotificationsOptIn: body.sms_notifications_opt_in ?? false,
			creditCardStatus: body.payments && !body.payments.waive ? 'Provided' : null,
			manageReservationUrl: `https://www.opentable.com/booking/manage?rid=${rid}&conf=${confirmationId}`,
			createdAt: now,
			updatedAt: now,
			createdAtUtc: now,
			updatedAtUtc: now
		})
		.returning();

	// Delete the slot lock
	await db.delete(slotLocks).where(eq(slotLocks.id, lock.id));

	const reservation = newReservation[0];

	// Fire-and-forget webhook
	const webhookPromise = dispatchWebhook(db, restaurant.id, 'reservation.created', {
		id: reservation.id,
		rid,
		confirmation_id: confirmationId,
		state: reservation.state,
		party_size: reservation.partySize,
		scheduled_time: reservation.scheduledTime,
		guest_id: reservation.guestId,
		origin: reservation.origin,
		dining_area_id: reservation.diningAreaId,
		created_at: reservation.createdAt
	}, event.locals.webhookAdapter ?? undefined).catch(() => {});
	event.platform?.context?.waitUntil(webhookPromise);

	// Fire-and-forget notification
	const notifCtx: ReservationContext = {
		restaurantName: restaurant.name,
		guestFirstName: body.first_name,
		guestLastName: body.last_name,
		guestEmail: null,
		guestPhone: typeof body.phone === 'string' ? body.phone : body.phone?.number ?? null,
		dateTime: lock.dateTime,
		partySize: lock.partySize,
		confirmationNumber: confirmationId,
		specialRequest: body.special_request,
		manageUrl: reservation.manageReservationUrl
	};
	const notifPromise = notifyReservationConfirmed(event.locals.notifications, notifCtx, 'noreply@freerez.com').catch(() => {});
	event.platform?.context?.waitUntil(notifPromise);

	return apiSuccess({
		confirmation_number: confirmationId,
		reservation_id: reservation.id,
		date_time: reservation.scheduledTime,
		party_size: reservation.partySize,
		special_request: reservation.guestRequest ?? ''
	});
};
