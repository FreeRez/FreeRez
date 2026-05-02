import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { restaurants, reservations, slotLocks, guests } from '$db/schema';
import { getAuthContext, apiError, apiSuccess, requireAuthorizedRid, parseJsonBody } from '$api/helpers';
import { dispatchWebhook } from '$api/webhook-dispatcher';
import { notifyReservationCancelled, notifyReservationModified } from '$lib/server/notifications/dispatcher';
import type { ReservationContext } from '$lib/server/notifications/types';

export const PUT: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;
	const auth = getAuthContext(event)!;

	const reservationId = event.params.id;
	if (!reservationId) return apiError('id is required', 400);

	const db = event.locals.db;

	// Resolve restaurant
	const rest = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);

	if (rest.length === 0) return apiError('Restaurant not found', 404);
	const restaurant = rest[0];

	const parsed = await parseJsonBody<{
		party_size?: string | number;
		date_time?: string;
		special_request?: string;
		reservation_token?: string;
	}>(event);
	if ('error' in parsed) return parsed.error;
	const body = parsed.data;

	// Get reservation by ID directly
	const results = await db
		.select()
		.from(reservations)
		.where(
			and(
				eq(reservations.restaurantId, restaurant.id),
				eq(reservations.id, reservationId)
			)
		)
		.limit(1);

	if (results.length === 0) return apiError('Reservation not found', 404);
	const reservation = results[0];

	// Validate slot lock if time/party size is changing
	if (body.reservation_token) {
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

		await db.delete(slotLocks).where(eq(slotLocks.id, lock.id));
	}

	const now = new Date().toISOString();
	const updateData: Record<string, unknown> = {
		updatedAt: now,
		updatedAtUtc: now
	};

	// party_size can be a string or number per spec
	if (body.party_size !== undefined) {
		updateData.partySize = typeof body.party_size === 'string'
			? parseInt(body.party_size, 10)
			: body.party_size;
	}
	if (body.date_time !== undefined) {
		updateData.scheduledTime = body.date_time;
		updateData.scheduledTimeUtc = body.date_time;
	}
	if (body.special_request !== undefined) updateData.guestRequest = body.special_request;

	await db
		.update(reservations)
		.set(updateData)
		.where(eq(reservations.id, reservation.id));

	// Fetch updated
	const updated = await db
		.select()
		.from(reservations)
		.where(eq(reservations.id, reservation.id))
		.limit(1);

	const updatedRes = updated[0];

	// Fire-and-forget webhook
	const updateWebhookPromise = dispatchWebhook(db, restaurant.id, 'reservation.updated', {
		id: updatedRes.id,
		rid,
		confirmation_id: updatedRes.confirmationId,
		state: updatedRes.state,
		party_size: updatedRes.partySize,
		scheduled_time: updatedRes.scheduledTime,
		guest_request: updatedRes.guestRequest,
		updated_at: updatedRes.updatedAt
	}, event.locals.webhookAdapter ?? undefined).catch(() => {});
	event.platform?.context?.waitUntil(updateWebhookPromise);

	// Fire-and-forget modification notification
	if (updatedRes.guestId) {
		const guestRows = await db
			.select()
			.from(guests)
			.where(eq(guests.id, updatedRes.guestId))
			.limit(1);
		if (guestRows.length > 0) {
			const guest = guestRows[0];
			const modifyCtx: ReservationContext = {
				restaurantName: restaurant.name,
				guestFirstName: guest.firstName ?? '',
				guestLastName: guest.lastName ?? '',
				guestEmail: guest.email,
				guestPhone: guest.phone,
				dateTime: updatedRes.scheduledTime ?? '',
				partySize: updatedRes.partySize ?? 0,
				confirmationNumber: updatedRes.confirmationId,
				specialRequest: updatedRes.guestRequest,
				manageUrl: updatedRes.manageReservationUrl
			};
			const modifyNotifPromise = notifyReservationModified(event.locals.notifications, modifyCtx, 'noreply@freerez.com').catch(() => {});
			event.platform?.context?.waitUntil(modifyNotifPromise);
		}
	}

	return apiSuccess({
		confirmation_number: updatedRes.confirmationId,
		reservation_id: updatedRes.id,
		date_time: updatedRes.scheduledTime,
		party_size: updatedRes.partySize,
		special_request: updatedRes.guestRequest ?? ''
	});
};

export const DELETE: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;
	const auth = getAuthContext(event)!;

	const reservationId = event.params.id;
	if (!reservationId) return apiError('id is required', 400);

	const db = event.locals.db;

	// Resolve restaurant
	const rest = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);

	if (rest.length === 0) return apiError('Restaurant not found', 404);
	const restaurant = rest[0];

	// Get reservation by ID directly (row ID)
	const results = await db
		.select()
		.from(reservations)
		.where(
			and(
				eq(reservations.restaurantId, restaurant.id),
				eq(reservations.id, reservationId)
			)
		)
		.limit(1);

	if (results.length === 0) return apiError('Reservation not found', 404);
	const reservation = results[0];

	// Check if already cancelled
	if (reservation.state === 'Cancelled' || reservation.state === 'CancelledWeb') {
		return apiError('Reservation is already cancelled', 400);
	}

	const now = new Date().toISOString();

	await db
		.update(reservations)
		.set({
			state: 'Cancelled',
			cancellationDate: now,
			cancellationDateUtc: now,
			updatedAt: now,
			updatedAtUtc: now
		})
		.where(eq(reservations.id, reservation.id));

	// Fire-and-forget webhook
	const cancelWebhookPromise = dispatchWebhook(db, restaurant.id, 'reservation.cancelled', {
		id: reservation.id,
		rid,
		confirmation_id: reservation.confirmationId,
		state: 'Cancelled',
		party_size: reservation.partySize,
		scheduled_time: reservation.scheduledTime,
		cancellation_date: now
	}, event.locals.webhookAdapter ?? undefined).catch(() => {});
	event.platform?.context?.waitUntil(cancelWebhookPromise);

	// Fire-and-forget cancellation notification
	if (reservation.guestId) {
		const guestRows = await db
			.select()
			.from(guests)
			.where(eq(guests.id, reservation.guestId))
			.limit(1);
		if (guestRows.length > 0) {
			const guest = guestRows[0];
			const cancelCtx: ReservationContext = {
				restaurantName: restaurant.name,
				guestFirstName: guest.firstName ?? '',
				guestLastName: guest.lastName ?? '',
				guestEmail: guest.email,
				guestPhone: guest.phone,
				dateTime: reservation.scheduledTime ?? '',
				partySize: reservation.partySize ?? 0,
				confirmationNumber: reservation.confirmationId,
				manageUrl: reservation.manageReservationUrl
			};
			const cancelNotifPromise = notifyReservationCancelled(event.locals.notifications, cancelCtx, 'noreply@freerez.com').catch(() => {});
			event.platform?.context?.waitUntil(cancelNotifPromise);
		}
	}

	return apiSuccess({
		RID: rid,
		ReservationId: reservationId,
		PartnerId: auth.partnerId ? parseInt(auth.partnerId, 10) : null,
		StatusCode: 0
	});
};
