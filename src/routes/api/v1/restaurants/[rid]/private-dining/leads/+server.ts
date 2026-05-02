import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { restaurants, privateDiningLeads } from '$db/schema';
import { getAuthContext, apiError, requireAuthorizedRid, parseJsonBody } from '$api/helpers';
import { json } from '@sveltejs/kit';

export const POST: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;
	const auth = getAuthContext(event)!;

	const db = event.locals.db;

	const parsed = await parseJsonBody<{
		firstName: string;
		lastName: string;
		email: string;
		phoneNumber?: string;
		eventDate?: string;
		eventTime?: string;
		partySize?: number;
		eventType?: string;
		flexibleDate?: boolean;
	}>(event);
	if ('error' in parsed) return parsed.error;
	const body = parsed.data;

	if (!body.firstName || !body.lastName || !body.email) {
		return apiError('firstName, lastName, and email are required', 400);
	}

	// Resolve restaurant
	const rest = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);

	if (rest.length === 0) return apiError('Restaurant not found', 404);
	const restaurant = rest[0];

	// Create private dining lead
	const newLead = await db
		.insert(privateDiningLeads)
		.values({
			restaurantId: restaurant.id,
			rid,
			firstName: body.firstName,
			lastName: body.lastName,
			email: body.email,
			phoneNumber: body.phoneNumber ?? null,
			eventDate: body.eventDate ?? null,
			eventTime: body.eventTime ?? null,
			partySize: body.partySize ?? null,
			eventType: body.eventType ?? null,
			flexibleDate: body.flexibleDate ?? false
		})
		.returning();

	return json(newLead[0].id, { status: 201 });
};
