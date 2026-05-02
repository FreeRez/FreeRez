import type { RequestHandler } from './$types';
import { eq, and, gte } from 'drizzle-orm';
import { guests, restaurants } from '$db/schema';
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
	const emailOptin = url.searchParams.get('email_optin');

	const conditions = [eq(guests.rid, ridNum)];
	if (updatedAfter) conditions.push(gte(guests.updatedAt, updatedAfter));
	if (emailOptin !== null && emailOptin !== undefined && emailOptin !== '') {
		conditions.push(eq(guests.emailOptin, emailOptin === 'true'));
	}

	const rows = await db
		.select()
		.from(guests)
		.where(and(...conditions))
		.limit(limit)
		.offset(offset);

	const items = rows.map((g) => {
		// Copper tier: base fields per OpenTable spec
		const base: Record<string, unknown> = {
			id: g.id,
			href: `/api/v1/restaurants/${ridNum}/guests/${g.id}`,
			rid: g.rid,
			sequence_id: g.sequenceId,
			gpid: g.gpid,
			tags: g.tags ?? null,
			birth_date: g.birthDate ?? null,
			anniversary_date: g.anniversaryDate ?? null,
			updated_at: g.updatedAt,
			forgotten: g.forgotten ?? false,
			archived: g.archived ?? false,
			company_name: g.companyName ?? '',
			created_date: g.createdAt,
			updated_at_utc: g.updatedAtUtc,
			notes: g.notes ?? null,
			notes_special_relationship: g.notesSpecialRelationship ?? null,
			notes_food_and_drink: g.notesFoodAndDrink ?? null,
			notes_seating: g.notesSeating ?? null,
			created_date_utc: g.createdAtUtc
		};

		// Gold tier adds: PII fields (name, email, phone, visits, marketing)
		if (auth.tier === 'gold' || auth.tier === 'platinum') {
			base.first_name = g.firstName;
			base.last_name = g.lastName;
			base.email = g.email;
			base.email_optin = g.emailOptin ?? false;
			base.phone = g.phone;
			base.phone_type = g.phoneType;
			base.primary_guest = g.primaryGuest ?? null;
			base.address = g.address ?? null;
			base.mail_opted_in = g.mailOptedIn ?? false;
			base.phone_numbers = g.phoneNumbers ?? [];
			base.marketing_opted_out = g.marketingOptedOut ?? false;
			base.date_last_visit = g.dateLastVisit ?? null;
			base.date_first_visit = g.dateFirstVisit ?? null;
			base.date_last_visit_utc = g.dateLastVisitUtc ?? null;
			base.date_first_visit_utc = g.dateFirstVisitUtc ?? null;
			base.is_hidden = g.isHidden ?? false;
		}

		// Platinum tier adds: date_email_opt_in_opt_out, sms_opt_in
		if (auth.tier === 'platinum') {
			base.date_email_opt_in_opt_out = g.dateEmailOptInOptOut ?? null;
			base.date_email_opt_in_opt_out_utc = g.dateEmailOptInOptOutUtc ?? null;
			base.sms_opt_in = g.smsOptIn ?? null;
		}

		return base;
	});

	return apiSuccess(paginatedResponse(items, offset, limit));
};

export const POST: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const ridNum = ridResult;
	const auth = getAuthContext(event)!;

	const db = event.locals.db;

	const restaurant = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, ridNum), eq(restaurants.active, true)))
		.limit(1);

	if (restaurant.length === 0) {
		return apiError('Restaurant not found', 404);
	}

	const parsed = await parseJsonBody<Record<string, unknown>>(event);
	if ('error' in parsed) return parsed.error;
	const body = parsed.data;

	const firstName = (body.first_name ?? body.firstName) as string | undefined;
	const lastName = (body.last_name ?? body.lastName) as string | undefined;

	if (!firstName || !lastName) {
		return apiError('first_name and last_name are required', 400);
	}

	const rawPhones = (body.phone_numbers ?? body.phoneNumbers) as Array<Record<string, unknown>> | undefined;
	const phoneNumbers = rawPhones?.map((p) => ({
		label: 'mobile',
		number: String(p.number ?? ''),
		country_code: String(p.country_code ?? p.countryCode ?? ''),
		primary: Boolean(p.is_primary ?? p.isPrimary ?? false)
	})) ?? [];

	const emailRaw = body.email;
	const emailStr = typeof emailRaw === 'string' ? emailRaw : (emailRaw as Record<string, unknown>)?.emailAddress as string ?? null;
	const emailOptin = Boolean(body.email_optin ?? (typeof emailRaw === 'object' && emailRaw ? (emailRaw as Record<string, unknown>).isEmailMarketingOptedIn : false));
	const primaryPhone = (body.phone as string) ?? phoneNumbers.find((p) => p.primary)?.number ?? phoneNumbers[0]?.number ?? null;

	const guestId = crypto.randomUUID();

	await db.insert(guests).values({
		id: guestId,
		restaurantId: restaurant[0].id,
		rid: ridNum,
		firstName,
		lastName,
		email: emailStr,
		emailOptin,
		phone: primaryPhone,
		tags: (body.tags as string[]) ?? null,
		notes: (body.notes as string) ?? null,
		smsOptIn: body.sms_opt_in ? Boolean(body.sms_opt_in) : null,
		phoneNumbers,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		createdAtUtc: new Date().toISOString(),
		updatedAtUtc: new Date().toISOString()
	});

	// Fire-and-forget webhook
	const webhookPromise = dispatchWebhook(db, restaurant[0].id, 'guest.created', {
		id: guestId,
		rid: ridNum,
		first_name: firstName,
		last_name: lastName,
		email: emailStr ?? null,
		phone: primaryPhone
	}, event.locals.webhookAdapter ?? undefined).catch(() => {});
	event.platform?.context?.waitUntil(webhookPromise);

	return apiSuccess({ guestId });
};
