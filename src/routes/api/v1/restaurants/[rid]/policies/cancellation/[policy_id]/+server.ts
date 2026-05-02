import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { restaurants, cancellationPolicies } from '$db/schema';
import { getAuthContext, apiError, apiSuccess, requireAuthorizedRid } from '$api/helpers';

export const GET: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;
	const auth = getAuthContext(event)!;

	const policyId = event.params.policy_id;
	if (!policyId) return apiError('policy_id is required', 400);

	const db = event.locals.db;

	// Resolve restaurant
	const rest = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);

	if (rest.length === 0) return apiError('Restaurant not found', 404);
	const restaurant = rest[0];

	// Get cancellation policy
	const policies = await db
		.select()
		.from(cancellationPolicies)
		.where(
			and(
				eq(cancellationPolicies.restaurantId, restaurant.id),
				eq(cancellationPolicies.id, policyId),
				eq(cancellationPolicies.active, true)
			)
		)
		.limit(1);

	if (policies.length === 0) return apiError('Cancellation policy not found', 404);
	const policy = policies[0];

	// Build response matching OpenTable spec
	const response: Record<string, unknown> = {
		name: policy.policyType,
		partySize: 1,
		policyType: policy.policyType
	};

	// Add deposit details for Deposit type
	if (policy.policyType === 'Deposit') {
		response.depositDetails = {
			amount: policy.depositAmount ?? 0,
			currency: policy.depositCurrency ?? 'USD',
			denominator: policy.depositDenominator ?? 100,
			type: policy.depositType ?? 'PerGuest'
		};
	}

	// Add hold details for CreditCard (Hold) type
	if (policy.policyType === 'CreditCard') {
		response.holdDetails = {
			cancellationPenaltyAmount: policy.depositAmount ?? 0,
			guestCountChangePenaltyAmount: policy.depositAmount ?? 0
		};
	}

	// Add cutoff information
	if (policy.cutoffType) {
		response.cutOff = {
			cutoffType: policy.cutoffType,
			daysBeforeCutoff: policy.cutoffValue ?? 0
		};
	}

	return apiSuccess(response);
};
