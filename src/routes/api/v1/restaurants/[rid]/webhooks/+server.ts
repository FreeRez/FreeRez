import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { restaurants, webhookSubscriptions } from '$db/schema';
import { getAuthContext, apiError, apiSuccess, requireAuthorizedRid, parseIntParam, parseJsonBody } from '$api/helpers';

export const GET: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;
	const auth = getAuthContext(event)!;

	const db = event.locals.db;
	const { url } = event;

	const limit = parseIntParam(url.searchParams.get('limit'), 50);
	const offset = parseIntParam(url.searchParams.get('offset'), 0);

	// Resolve restaurant
	const rest = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);

	if (rest.length === 0) return apiError('Restaurant not found', 404);
	const restaurant = rest[0];

	const allSubscriptions = await db
		.select()
		.from(webhookSubscriptions)
		.where(eq(webhookSubscriptions.restaurantId, restaurant.id));

	const total = allSubscriptions.length;
	const paged = allSubscriptions.slice(offset, offset + limit);

	return apiSuccess({
		subscriptions: paged.map((s) => ({
			id: s.id,
			restaurant_id: s.restaurantId,
			partner_id: s.partnerId,
			url: s.url,
			events: s.events,
			active: s.active,
			created_at: s.createdAt,
			updated_at: s.updatedAt
		})),
		total
	});
};

interface WebhookCreateBody {
	url: string;
	events: string[];
	secret?: string;
}

export const POST: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;
	const auth = getAuthContext(event)!;

	const db = event.locals.db;

	const parsed = await parseJsonBody<WebhookCreateBody>(event);
	if ('error' in parsed) return parsed.error;
	const body = parsed.data;

	if (!body.url) return apiError('url is required', 400);
	if (!body.events || !Array.isArray(body.events) || body.events.length === 0) {
		return apiError('events must be a non-empty array', 400);
	}

	// Resolve restaurant
	const rest = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);

	if (rest.length === 0) return apiError('Restaurant not found', 404);
	const restaurant = rest[0];

	const subscriptionId = crypto.randomUUID();

	await db.insert(webhookSubscriptions).values({
		id: subscriptionId,
		restaurantId: restaurant.id,
		partnerId: auth.partnerId,
		url: body.url,
		events: body.events,
		secret: body.secret ?? null,
		active: true
	});

	const inserted = await db
		.select()
		.from(webhookSubscriptions)
		.where(eq(webhookSubscriptions.id, subscriptionId))
		.limit(1);

	if (inserted.length === 0) return apiError('Failed to create subscription', 500);

	const s = inserted[0];

	return apiSuccess(
		{
			id: s.id,
			restaurant_id: s.restaurantId,
			partner_id: s.partnerId,
			url: s.url,
			events: s.events,
			secret: s.secret,
			active: s.active,
			created_at: s.createdAt,
			updated_at: s.updatedAt
		},
		201
	);
};
