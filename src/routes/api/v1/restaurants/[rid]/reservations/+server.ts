import type { RequestHandler } from './$types';
import { eq, and, gte, lte } from 'drizzle-orm';
import { restaurants, reservations, slotLocks, guests } from '$db/schema';
import {
	apiError,
	apiSuccess,
	getAuthContext,
	requireAuthorizedRid,
	parseIntParam,
	paginatedResponse,
	parseJsonBody
} from '$api/helpers';
import { dispatchWebhook } from '$api/webhook-dispatcher';
import { notifyReservationConfirmed } from '$lib/server/notifications/dispatcher';
import type { ReservationContext } from '$lib/server/notifications/types';

export const GET: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const ridNum = ridResult;
	const auth = getAuthContext(event)!;

	const { url, locals } = event;
	const db = locals.db;

	const limit = parseIntParam(url.searchParams.get('limit'), 1000);
	const offset = parseIntParam(url.searchParams.get('offset'), 0);
	const updatedAfter = url.searchParams.get('updated_after');
	const scheduledTimeFrom = url.searchParams.get('scheduled_time_from');
	const scheduledTimeTo = url.searchParams.get('scheduled_time_to');

	const conditions = [eq(reservations.rid, ridNum)];
	if (updatedAfter) conditions.push(gte(reservations.updatedAt, updatedAfter));
	if (scheduledTimeFrom) conditions.push(gte(reservations.scheduledTime, scheduledTimeFrom));
	if (scheduledTimeTo) conditions.push(lte(reservations.scheduledTime, scheduledTimeTo));

	const rows = await db
		.select()
		.from(reservations)
		.leftJoin(guests, eq(reservations.guestId, guests.id))
		.where(and(...conditions))
		.limit(limit)
		.offset(offset);

	const items = rows.map((row) => {
		const r = row.reservations;
		const g = row.guests;

		// Copper tier: base fields per OpenTable spec
		const base: Record<string, unknown> = {
			id: r.id,
			href: `/api/v1/restaurants/${ridNum}/reservations/${r.id}`,
			rid: r.rid,
			sequence_id: r.sequenceId,
			guest_id: r.guestId,
			guest: r.guestId ? `/api/v1/restaurants/${ridNum}/guests/${r.guestId}` : null,
			confirmation_id: r.confirmationId,
			state: r.state,
			table_number: r.tableNumber,
			created_date: r.createdAt,
			scheduled_time: r.scheduledTime,
			party_size: r.partySize,
			visit_tags: r.visitTags ?? [],
			origin: r.origin,
			updated_at: r.updatedAt,
			seated_time: r.seatedTime,
			done_time: r.doneTime,
			pos_data: r.posData ?? {
				check_ids: null,
				pos_sub_total: null,
				pos_tax: null,
				pos_tip: null,
				pos_total_spend: null
			},
			scheduled_time_utc: r.scheduledTimeUtc,
			guest_request: r.guestRequest,
			venue_notes: r.venueNotes,
			opentable_notes: r.opentableNotes,
			table_category: r.tableCategory,
			seated_time_utc: r.seatedTimeUtc,
			done_time_utc: r.doneTimeUtc,
			created_date_utc: r.createdAtUtc,
			updated_at_utc: r.updatedAtUtc,
			server: r.server,
			arrived_time: r.arrivedTime,
			arrived_time_utc: r.arrivedTimeUtc,
			currency_code: r.currencyCode,
			currency_denominator: r.currencyDenominator ?? 100,
			experience_details: r.experienceDetails ?? null,
			deposit: r.depositDetails ?? null
		};

		// Gold tier adds: marketing_opted_out, referrer, added_to_waitlist, added_to_waitlist_utc
		if (auth.tier === 'gold' || auth.tier === 'platinum') {
			base.marketing_opted_out = r.marketingOptedOut ?? false;
			base.referrer = r.referrer ?? null;
			base.added_to_waitlist = r.addedToWaitlist ?? null;
			base.added_to_waitlist_utc = r.addedToWaitlistUtc ?? null;
		}

		// Platinum tier adds: email, sms_opt_in, quoted_wait_time, online_source, discovery_type,
		// partner, campaign_details, credit_card_status, cancellation_date, cancellation_date_utc,
		// rest_ref_campaign_name, rest_ref_id, rest_ref_source, ot_boost_type
		if (auth.tier === 'platinum') {
			base.email = g?.email ?? '';
			base.sms_opt_in = r.smsNotificationsOptIn ?? null;
			base.quoted_wait_time = r.quotedWaitTime ?? 0;
			base.online_source = r.onlineSource ?? null;
			base.discovery_type = r.discoveryType ?? null;
			base.partner = r.partner ?? null;
			base.campaign_details = r.campaignDetails ?? null;
			base.credit_card_status = r.creditCardStatus ?? null;
			base.cancellation_date = r.cancellationDate ?? null;
			base.cancellation_date_utc = r.cancellationDateUtc ?? null;
			base.rest_ref_campaign_name = r.restRefCampaignName ?? null;
			base.rest_ref_id = r.restRefId ?? null;
			base.rest_ref_source = r.restRefSource ?? null;
			base.ot_boost_type = null;
		}

		return base;
	});

	return apiSuccess(paginatedResponse(items, offset, limit));
};

export const POST: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;
	const auth = getAuthContext(event)!;

	const db = event.locals.db;

	const parsed = await parseJsonBody<{
		reservation_token: string;
		first_name: string;
		last_name: string;
		email_address?: string;
		phone?: {
			number: string;
			country_code: string;
			phone_type?: string;
		};
		reservation_attribute?: string;
		special_request?: string;
		restaurant_email_marketing_opt_in?: string | boolean;
		dining_area_id?: string | number;
		environment?: string;
		experience?: {
			id: number;
			version: number;
			party_size_per_price_type?: Array<{ id: number; count: number }>;
			add_ons?: Array<{ item_id: string; quantity: number }>;
		};
		credit_card?: {
			token: string;
			last_four: string;
			brand: string;
		};
		sms_notifications_opt_in?: boolean;
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

	// Check if lock is expired
	if (new Date(lock.expiresAt) < new Date()) {
		await db.delete(slotLocks).where(eq(slotLocks.id, lock.id));
		return apiError('Reservation token has expired', 410);
	}

	// Parse phone number
	const phoneNumber = body.phone?.number ?? null;

	// Parse restaurant_email_marketing_opt_in (can be string "true" or boolean)
	const emailMarketingOptIn =
		body.restaurant_email_marketing_opt_in === 'true' ||
		body.restaurant_email_marketing_opt_in === true;

	// Parse dining_area_id (can be string or number)
	const diningAreaId = body.dining_area_id
		? typeof body.dining_area_id === 'string'
			? parseInt(body.dining_area_id, 10)
			: body.dining_area_id
		: lock.diningAreaId ?? null;

	// Find or create guest
	let guestId: string | null = null;
	if (body.email_address) {
		const existingGuests = await db
			.select()
			.from(guests)
			.where(and(eq(guests.restaurantId, restaurant.id), eq(guests.email, body.email_address)))
			.limit(1);

		if (existingGuests.length > 0) {
			guestId = existingGuests[0].id;
			await db
				.update(guests)
				.set({
					firstName: body.first_name,
					lastName: body.last_name,
					phone: phoneNumber ?? existingGuests[0].phone,
					emailOptin: emailMarketingOptIn,
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
					email: body.email_address,
					phone: phoneNumber,
					emailOptin: emailMarketingOptIn
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
			reservationAttribute: body.reservation_attribute ?? lock.reservationAttribute ?? 'default',
			origin: 'Web',
			guestRequest: body.special_request ?? null,
			diningAreaId: diningAreaId,
			environment: (body.environment as 'Indoor' | 'Outdoor') ?? null,
			restaurantEmailMarketingOptIn: emailMarketingOptIn,
			smsNotificationsOptIn: body.sms_notifications_opt_in ?? null,
			creditCardStatus: body.credit_card ? 'Provided' : null,
			experienceDetails: body.experience
				? {
						experience_id: body.experience.id,
						experience_title: '',
						experience_description: '',
						subtotalAmount: 0,
						add_ons: [],
						addon_subtotal_amount: 0,
						diner_payment_status: null,
						service_fee_amount: 0,
						taxes_amount: 0,
						tip_amount: 0,
						total_amount: 0
					}
				: null,
			manageReservationUrl: `https://www.opentable.com/book/view?rid=${rid}&confnumber=${confirmationId}&token=${crypto.randomUUID().replace(/-/g, '')}`,
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
		guestEmail: body.email_address,
		guestPhone: body.phone?.number,
		dateTime: lock.dateTime,
		partySize: lock.partySize,
		confirmationNumber: confirmationId,
		specialRequest: body.special_request,
		manageUrl: reservation.manageReservationUrl
	};
	const notifPromise = notifyReservationConfirmed(event.locals.notifications, notifCtx, 'noreply@freerez.com').catch(() => {});
	event.platform?.context?.waitUntil(notifPromise);

	// Get booking policy message for the response
	return apiSuccess(
		{
			message: 'Reservation confirmed',
			confirmation_number: confirmationId,
			offer_confirmation_number: 0,
			date_time: reservation.scheduledTime,
			party_size: reservation.partySize,
			notes: reservation.guestRequest ?? '',
			manage_reservation_url: reservation.manageReservationUrl
		},
		201
	);
};
