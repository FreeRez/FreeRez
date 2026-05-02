import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { restaurants, webhookSubscriptions } from '$db/schema';
import { getAuthContext, apiError, apiSuccess, requireAuthorizedRid, parseJsonBody } from '$api/helpers';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;
	const auth = getAuthContext(event)!;

	const id = event.params.webhook_id;
	if (!id) return apiError('Webhook ID is required', 400);

	const db = event.locals.db;

	// Resolve restaurant to ensure it exists and caller has access
	const rest = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);

	if (rest.length === 0) return apiError('Restaurant not found', 404);
	const restaurant = rest[0];

	const subscription = await db
		.select()
		.from(webhookSubscriptions)
		.where(
			and(
				eq(webhookSubscriptions.id, id),
				eq(webhookSubscriptions.restaurantId, restaurant.id)
			)
		)
		.limit(1);

	if (subscription.length === 0) return apiError('Webhook subscription not found', 404);

	const s = subscription[0];

	return apiSuccess({
		id: s.id,
		restaurant_id: s.restaurantId,
		partner_id: s.partnerId,
		url: s.url,
		events: s.events,
		secret: s.secret,
		active: s.active,
		created_at: s.createdAt,
		updated_at: s.updatedAt
	});
};

interface WebhookUpdateBody {
	url?: string;
	events?: string[];
	secret?: string;
	active?: boolean;
}

export const PUT: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;
	const auth = getAuthContext(event)!;

	const id = event.params.webhook_id;
	if (!id) return apiError('Webhook ID is required', 400);

	const db = event.locals.db;

	const parsed = await parseJsonBody<WebhookUpdateBody>(event);
	if ('error' in parsed) return parsed.error;
	const body = parsed.data;

	// Resolve restaurant
	const rest = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);

	if (rest.length === 0) return apiError('Restaurant not found', 404);
	const restaurant = rest[0];

	// Check exists and belongs to this restaurant
	const existing = await db
		.select()
		.from(webhookSubscriptions)
		.where(
			and(
				eq(webhookSubscriptions.id, id),
				eq(webhookSubscriptions.restaurantId, restaurant.id)
			)
		)
		.limit(1);

	if (existing.length === 0) return apiError('Webhook subscription not found', 404);

	const updateData: Record<string, unknown> = {
		updatedAt: new Date().toISOString()
	};

	if (body.url !== undefined) updateData.url = body.url;
	if (body.events !== undefined) updateData.events = body.events;
	if (body.secret !== undefined) updateData.secret = body.secret;
	if (body.active !== undefined) updateData.active = body.active;

	await db
		.update(webhookSubscriptions)
		.set(updateData)
		.where(eq(webhookSubscriptions.id, id));

	const updated = await db
		.select()
		.from(webhookSubscriptions)
		.where(eq(webhookSubscriptions.id, id))
		.limit(1);

	const s = updated[0];

	return apiSuccess({
		id: s.id,
		restaurant_id: s.restaurantId,
		partner_id: s.partnerId,
		url: s.url,
		events: s.events,
		secret: s.secret,
		active: s.active,
		created_at: s.createdAt,
		updated_at: s.updatedAt
	});
};

export const DELETE: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;
	const auth = getAuthContext(event)!;

	const id = event.params.webhook_id;
	if (!id) return apiError('Webhook ID is required', 400);

	const db = event.locals.db;

	// Resolve restaurant
	const rest = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);

	if (rest.length === 0) return apiError('Restaurant not found', 404);
	const restaurant = rest[0];

	// Check exists and belongs to this restaurant
	const existing = await db
		.select()
		.from(webhookSubscriptions)
		.where(
			and(
				eq(webhookSubscriptions.id, id),
				eq(webhookSubscriptions.restaurantId, restaurant.id)
			)
		)
		.limit(1);

	if (existing.length === 0) return apiError('Webhook subscription not found', 404);

	await db
		.delete(webhookSubscriptions)
		.where(eq(webhookSubscriptions.id, id));

	return json(null, { status: 200 });
};
