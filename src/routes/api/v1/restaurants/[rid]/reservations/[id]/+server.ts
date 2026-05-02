import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { restaurants, reservations, slotLocks, guests } from '$db/schema';
import { getAuthContext, apiError, apiSuccess, requireAuthorizedRid, parseJsonBody } from '$api/helpers';
import { dispatchWebhook } from '$api/webhook-dispatcher';
import { notifyReservationCancelled, notifyReservationModified } from '$lib/server/notifications/dispatcher';
import type { ReservationContext } from '$lib/server/notifications/types';

function parseReservationId(reservationId: string): { rid: number; confirmationId: number } | null {
	const parts = reservationId.split('-');
	if (parts.length < 2) return null;
	const rid = parseInt(parts[0], 10);
	const confirmationId = parseInt(parts.slice(1).join(''), 10);
	if (isNaN(rid) || isNaN(confirmationId)) return null;
	return { rid, confirmationId };
}

export const GET: RequestHandler = async (event) => {
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

	// Consumer: id is "rid-confirmationId" format
	const parsed = parseReservationId(reservationId);
	if (!parsed) return apiError('Invalid id format. Expected: rid-confirmationId', 400);
	if (parsed.rid !== rid) return apiError('Restaurant ID mismatch', 400);

	const results = await db
		.select()
		.from(reservations)
		.where(
			and(
				eq(reservations.restaurantId, restaurant.id),
				eq(reservations.confirmationId, parsed.confirmationId)
			)
		)
		.limit(1);

	if (results.length === 0) return apiError('Reservation not found', 404);
	const reservation = results[0];

	// Build response matching OpenTable spec
	const response: Record<string, unknown> = {
		confirmation_number: reservation.confirmationId,
		restaurant_id: rid,
		date_time: reservation.scheduledTime,
		party_size: reservation.partySize,
		manage_reservation_url: reservation.manageReservationUrl,
		reservation_attribute: reservation.reservationAttribute ?? 'Default',
		status: reservation.state,
		notes: reservation.guestRequest ?? '',
		dining_area_id: reservation.diningAreaId,
		environment: reservation.environment
	};

	// Add experience details if present
	if (reservation.experienceDetails) {
		response.experience = reservation.experienceDetails;
	}

	// Add credit card info if present
	if (reservation.creditCardStatus) {
		response.credit_card_last_four = reservation.creditCardStatus;
	}

	// Add language
	response.language = 'en-US';

	return apiSuccess(response);
};

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

	const parsedId = parseReservationId(reservationId);
	if (!parsedId) return apiError('Invalid id format. Expected: rid-confirmationId', 400);
	if (parsedId.rid !== rid) return apiError('Restaurant ID mismatch', 400);

	const parsed = await parseJsonBody<{
		status?: string;
		party_size?: number;
		date_time?: string;
		reservation_attribute?: string;
		reservation_token?: string;
		special_request?: string;
		experience?: {
			id: number;
			version: number;
			party_size_per_price_type?: Array<{ id: number; count: number }>;
			add_ons?: Array<{ item_id: string; quantity: number }>;
		};
	}>(event);
	if ('error' in parsed) return parsed.error;
	const body = parsed.data;

	// Get reservation
	const results = await db
		.select()
		.from(reservations)
		.where(
			and(
				eq(reservations.restaurantId, restaurant.id),
				eq(reservations.confirmationId, parsedId.confirmationId)
			)
		)
		.limit(1);

	if (results.length === 0) return apiError('Reservation not found', 404);
	const reservation = results[0];

	const now = new Date().toISOString();

	// Handle cancellation (PUT with status: "CancelledWeb")
	if (body.status === 'CancelledWeb') {
		await db
			.update(reservations)
			.set({
				state: 'CancelledWeb',
				cancellationDate: now,
				cancellationDateUtc: now,
				updatedAt: now,
				updatedAtUtc: now
			})
			.where(eq(reservations.id, reservation.id));

		// Fire-and-forget webhook
		const webhookPromise = dispatchWebhook(db, restaurant.id, 'reservation.cancelled', {
			id: reservation.id,
			rid,
			confirmation_id: reservation.confirmationId,
			state: 'CancelledWeb',
			party_size: reservation.partySize,
			scheduled_time: reservation.scheduledTime,
			cancellation_date: now
		}, event.locals.webhookAdapter ?? undefined).catch(() => {});
		event.platform?.context?.waitUntil(webhookPromise);

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

		// OpenTable returns 200 with empty body for cancellation
		return apiSuccess(undefined as unknown as null);
	}

	// Handle modification
	if (body.reservation_token) {
		// Validate new slot lock
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

		if (locks.length === 0)
			return apiError('reservation_token or restaurant id is invalid', 400);
		const lock = locks[0];

		if (new Date(lock.expiresAt) < new Date()) {
			await db.delete(slotLocks).where(eq(slotLocks.id, lock.id));
			return apiError('Reservation token has expired', 410);
		}

		// Delete used lock
		await db.delete(slotLocks).where(eq(slotLocks.id, lock.id));
	}

	const updateData: Record<string, unknown> = {
		updatedAt: now,
		updatedAtUtc: now
	};

	if (body.party_size !== undefined) updateData.partySize = body.party_size;
	if (body.date_time !== undefined) {
		updateData.scheduledTime = body.date_time;
		updateData.scheduledTimeUtc = body.date_time;
	}
	if (body.reservation_attribute !== undefined)
		updateData.reservationAttribute = body.reservation_attribute;
	if (body.special_request !== undefined) updateData.guestRequest = body.special_request;

	await db.update(reservations).set(updateData).where(eq(reservations.id, reservation.id));

	// Fetch updated reservation
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

	// Response matches OpenTable Modify Res format
	return apiSuccess({
		message: 'Reservation modified',
		confirmation_number: updatedRes.confirmationId,
		date_time: updatedRes.scheduledTime,
		party_size: updatedRes.partySize,
		notes: updatedRes.guestRequest ?? ''
	});
};
