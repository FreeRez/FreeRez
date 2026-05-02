import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { guestTagDefinitions, restaurants } from '$db/schema';
import { apiError, apiSuccess, getAuthContext, requireAuthorizedRid, parseJsonBody } from '$api/helpers';

export const PUT: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const ridNum = ridResult;
	const auth = getAuthContext(event)!;

	const tagId = event.params.tag_id;
	if (!tagId) return apiError('tag_id is required', 400);

	const db = event.locals.db;

	const restaurant = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, ridNum), eq(restaurants.active, true)))
		.limit(1);

	if (restaurant.length === 0) {
		return apiError('Restaurant not found', 404);
	}

	const parsed = await parseJsonBody<{ displayName?: string; category?: string }>(event);
	if ('error' in parsed) return parsed.error;
	const body = parsed.data;

	if (!body.displayName || !body.category) {
		return apiError('displayName and category are required', 400);
	}

	// Check if tag already exists
	const existing = await db
		.select()
		.from(guestTagDefinitions)
		.where(
			and(
				eq(guestTagDefinitions.restaurantId, restaurant[0].id),
				eq(guestTagDefinitions.tagId, tagId)
			)
		)
		.limit(1);

	if (existing.length > 0) {
		// Update existing tag
		await db
			.update(guestTagDefinitions)
			.set({
				displayName: body.displayName,
				category: body.category
			})
			.where(eq(guestTagDefinitions.id, existing[0].id));
	} else {
		// Create new tag
		await db.insert(guestTagDefinitions).values({
			restaurantId: restaurant[0].id,
			tagId,
			displayName: body.displayName,
			category: body.category,
			createdAt: new Date().toISOString()
		});
	}

	return apiSuccess({
		id: tagId,
		displayName: body.displayName,
		category: body.category
	});
};

export const DELETE: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const ridNum = ridResult;
	const auth = getAuthContext(event)!;

	const tagId = event.params.tag_id;
	if (!tagId) return apiError('tag_id is required', 400);

	const db = event.locals.db;

	const restaurant = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, ridNum), eq(restaurants.active, true)))
		.limit(1);

	if (restaurant.length === 0) {
		return apiError('Restaurant not found', 404);
	}

	const existing = await db
		.select()
		.from(guestTagDefinitions)
		.where(
			and(
				eq(guestTagDefinitions.restaurantId, restaurant[0].id),
				eq(guestTagDefinitions.tagId, tagId)
			)
		)
		.limit(1);

	if (existing.length === 0) {
		return apiError('Tag not found', 404);
	}

	await db
		.delete(guestTagDefinitions)
		.where(eq(guestTagDefinitions.id, existing[0].id));

	return new Response(null, { status: 200 });
};
