import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { guests, guestLoyalties, restaurants } from '$db/schema';
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
		loyalties?: Array<{
			programName?: string;
			loyaltyTier?: string;
			pointsBalance?: string;
			accountId?: string;
			flexFields?: Array<{ label: string; value: string }>;
		}>;
	}>(event);
	if ('error' in parsed) return parsed.error;
	const body = parsed.data;

	if (!body.loyalties || !Array.isArray(body.loyalties)) {
		return apiError('loyalties array is required', 400);
	}

	// Delete existing loyalties for this guest
	await db.delete(guestLoyalties).where(eq(guestLoyalties.guestId, guestId));

	// Insert new loyalties
	const responseLoyalties: Array<Record<string, unknown>> = [];
	for (const loyalty of body.loyalties) {
		if (!loyalty.programName) {
			return apiError('programName is required for each loyalty', 400);
		}

		await db.insert(guestLoyalties).values({
			guestId,
			programName: loyalty.programName,
			loyaltyTier: loyalty.loyaltyTier ?? null,
			pointsBalance: loyalty.pointsBalance ?? null,
			accountId: loyalty.accountId ?? null,
			flexFields: loyalty.flexFields ?? null,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		});

		responseLoyalties.push({
			programName: loyalty.programName,
			loyaltyTier: loyalty.loyaltyTier ?? null,
			pointsBalance: loyalty.pointsBalance ?? null,
			accountId: loyalty.accountId ?? null,
			flexFields: loyalty.flexFields ?? null
		});
	}

	return apiSuccess({ loyalties: responseLoyalties });
};
