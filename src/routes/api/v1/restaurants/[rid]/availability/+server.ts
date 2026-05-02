import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { cancellationPolicies } from '$db/schema';
import { getAuthContext, apiError, apiSuccess, requireAuthorizedRid, parseIntParam } from '$api/helpers';
import { calculateAvailability } from '$api/availability-engine';

export const GET: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;
	const auth = getAuthContext(event)!;

	const { url, locals } = event;
	const db = locals.db;

	const startDateTime = url.searchParams.get('start_date_time');
	if (!startDateTime) return apiError('start_date_time is required', 400);

	const forwardMinutes = parseIntParam(url.searchParams.get('forward_minutes'), 120);
	const backwardMinutes = parseIntParam(url.searchParams.get('backward_minutes'), 0);
	const partySize = parseIntParam(url.searchParams.get('party_size'), 2);
	const includeExperiences = url.searchParams.get('include_experiences') === 'true';

	// Consumer-only params
	const requireAttributes = url.searchParams.get('require_attributes');
	const includeCreditCardResults = url.searchParams.get('include_credit_card_results') === 'true';

	const result = await calculateAvailability({
		db,
		restaurantId: '', // will be resolved internally by the engine via rid
		rid,
		startDateTime,
		forwardMinutes,
		backwardMinutes,
		partySize,
		includeExperiences
	});
	if (!result) return apiError('Restaurant not found', 404);

	const restaurant = result.restaurant;

	// Get cancellation policies for credit card results
	const cancelPolicies = includeCreditCardResults
		? await db
				.select()
				.from(cancellationPolicies)
				.where(
					and(
						eq(cancellationPolicies.restaurantId, restaurant.id),
						eq(cancellationPolicies.active, true)
					)
				)
		: [];

	// Build cancellation policy object for response
	const buildCancellationPolicy = () => {
		if (cancelPolicies.length === 0) return {};
		const cp = cancelPolicies[0];
		if (cp.policyType === 'None') return {};
		return {
			type: cp.policyType,
			id: cp.id,
			amount: cp.depositAmount ?? 0,
			denominator: cp.depositDenominator ?? 100,
			currency: cp.depositCurrency ?? 'USD',
			deposit_type: cp.depositType ?? 'PerGuest'
		};
	};

	const times: string[] = [];
	const timesAvailable: Array<{
		time: string;
		availability_types: Array<Record<string, unknown>>;
	}> = [];

	for (const slot of result.slots) {
		if (!slot.canSeatParty) continue;

		const timeStr = slot.time;
		times.push(timeStr);

		const availabilityTypes: Array<Record<string, unknown>> = [];

		// Group available tables by dining area
		const areaMap = new Map<number, typeof slot.availableTables>();
		for (const table of slot.availableTables) {
			const existing = areaMap.get(table.areaId) ?? [];
			existing.push(table);
			areaMap.set(table.areaId, existing);
		}

		// Filter dining areas by required attributes if specified
		const filteredEntries = requireAttributes
			? [...areaMap.entries()].filter(([, tables]) =>
					tables[0].attributes.includes(requireAttributes)
				)
			: [...areaMap.entries()];

		// Build dining area entries
		const diningAreaEntries = filteredEntries.map(([areaId, tables]) => ({
			id: areaId,
			attributes: tables[0].attributes,
			environment: tables[0].environment ?? 'Indoor',
			booking_url: `${restaurant.reservationUrl ?? ''}/booking?rid=${rid}&d=${encodeURIComponent(timeStr)}&p=${partySize}&diningAreaId=${areaId}`,
			booking_restref_url: `${restaurant.reservationUrl ?? ''}/restref/client?rid=${rid}&dateTime=${encodeURIComponent(timeStr)}&partySize=${partySize}&restref=${rid}`
		}));

		// Standard availability
		const cancellationPolicy = buildCancellationPolicy();
		availabilityTypes.push({
			type: 'Standard',
			cancellation_policy: cancellationPolicy,
			dining_area: diningAreaEntries
		});

		// Experience availability
		if (includeExperiences && result.activeExperiences.length > 0) {
			const experienceIds = result.activeExperiences.map((e) => e.experienceId);
			const experienceDiningAreas = diningAreaEntries.map((da) => ({
				...da,
				experience_ids: experienceIds
			}));

			availabilityTypes.push({
				type: 'Experience',
				cancellation_policy: cancellationPolicy,
				dining_area: experienceDiningAreas
			});
		}

		timesAvailable.push({
			time: timeStr,
			availability_types: availabilityTypes
		});
	}

	return apiSuccess({
		rid,
		party_size: partySize,
		times,
		times_available: timesAvailable
	});
};
