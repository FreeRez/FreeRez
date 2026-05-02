import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { guests, guestInsights, restaurants } from '$db/schema';
import { apiError, apiSuccess, getAuthContext, requireAuthorizedRid, parseJsonBody } from '$api/helpers';

export const PUT: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const ridNum = ridResult;
	const auth = getAuthContext(event)!;

	const guestId = event.params.guest_id;
	if (!guestId) return apiError('guest_id is required', 400);

	const db = event.locals.db;

	const restaurant = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, ridNum), eq(restaurants.active, true)))
		.limit(1);

	if (restaurant.length === 0) {
		return apiError('Restaurant not found', 404);
	}

	const guest = await db
		.select()
		.from(guests)
		.where(and(eq(guests.id, guestId), eq(guests.restaurantId, restaurant[0].id)))
		.limit(1);

	if (guest.length === 0) {
		return apiError('Guest not found', 404);
	}

	const parsed = await parseJsonBody<{
		insights?: Array<{ label?: string; value?: string }>;
	}>(event);
	if ('error' in parsed) return parsed.error;
	const body = parsed.data;

	if (!body.insights || !Array.isArray(body.insights)) {
		return apiError('insights array is required', 400);
	}

	// Delete existing insights for this guest
	await db.delete(guestInsights).where(eq(guestInsights.guestId, guestId));

	// Insert new insights
	const responseInsights: Array<{ label: string; value: string }> = [];
	for (const insight of body.insights) {
		if (!insight.label || !insight.value) {
			return apiError('label and value are required for each insight', 400);
		}

		await db.insert(guestInsights).values({
			guestId,
			label: insight.label,
			value: insight.value,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		});

		responseInsights.push({
			label: insight.label,
			value: insight.value
		});
	}

	return apiSuccess({ insights: responseInsights });
};
