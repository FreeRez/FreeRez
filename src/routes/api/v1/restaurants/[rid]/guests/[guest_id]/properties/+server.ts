import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { guests, guestProperties, restaurants } from '$db/schema';
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
		properties?: Array<{
			propertyName?: string;
			resStatusCode?: string;
			reservationId?: string;
			resArriveDate?: string;
			resDepartDate?: string;
			roomNumber?: string;
			rateCode?: string;
			flexFields?: Array<{ label: string; value: string }>;
		}>;
	}>(event);
	if ('error' in parsed) return parsed.error;
	const body = parsed.data;

	if (!body.properties || !Array.isArray(body.properties)) {
		return apiError('properties array is required', 400);
	}

	// Delete existing properties for this guest
	await db.delete(guestProperties).where(eq(guestProperties.guestId, guestId));

	// Insert new properties
	const responseProperties: Array<Record<string, unknown>> = [];
	for (const prop of body.properties) {
		if (!prop.propertyName) {
			return apiError('propertyName is required for each property', 400);
		}

		await db.insert(guestProperties).values({
			guestId,
			propertyName: prop.propertyName,
			resStatusCode: prop.resStatusCode ?? null,
			reservationId: prop.reservationId ?? null,
			resArriveDate: prop.resArriveDate ?? null,
			resDepartDate: prop.resDepartDate ?? null,
			roomNumber: prop.roomNumber ?? null,
			rateCode: prop.rateCode ?? null,
			flexFields: prop.flexFields ?? null,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		});

		responseProperties.push({
			propertyName: prop.propertyName,
			resStatusCode: prop.resStatusCode ?? null,
			reservationId: prop.reservationId ?? null,
			resArriveDate: prop.resArriveDate ?? null,
			resDepartDate: prop.resDepartDate ?? null,
			roomNumber: prop.roomNumber ?? null,
			rateCode: prop.rateCode ?? null,
			flexFields: prop.flexFields ?? null
		});
	}

	return apiSuccess({ properties: responseProperties });
};
