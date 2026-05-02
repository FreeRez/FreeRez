import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { restaurants, bookingPolicies } from '$db/schema';
import { getAuthContext, apiError, apiSuccess, requireAuthorizedRid } from '$api/helpers';

export const GET: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;
	const auth = getAuthContext(event)!;

	const date = event.url.searchParams.get('date');
	const time = event.url.searchParams.get('time');
	const partySize = event.url.searchParams.get('party_size');

	if (!date || !time || !partySize) {
		return apiError('date, time, and party_size query parameters are required', 400);
	}

	// dinerContext query param (optional, e.g. "details")
	const _dinerContext = event.url.searchParams.get('dinerContext');

	const db = event.locals.db;

	// Resolve restaurant
	const rest = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);

	if (rest.length === 0) return apiError('Restaurant not found', 404);
	const restaurant = rest[0];

	// Get booking policies
	const policies = await db
		.select()
		.from(bookingPolicies)
		.where(and(eq(bookingPolicies.restaurantId, restaurant.id), eq(bookingPolicies.active, true)));

	const formattedPolicies = policies.map((policy) => {
		const code = policy.languageCode ?? 'en';
		const region = policy.languageRegion ?? 'US';
		return {
			Message: policy.message,
			Type: policy.policyType,
			Language: {
				Code: code,
				Region: region,
				IETF: `${code}-${region}`
			}
		};
	});

	return apiSuccess({
		Policies: formattedPolicies
	});
};
