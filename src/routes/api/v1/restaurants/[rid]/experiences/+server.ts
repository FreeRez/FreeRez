import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import {
	restaurants,
	experiences,
	experiencePrices,
	experienceAddOnGroups,
	experienceAddOns,
	experienceServiceCharges,
	experienceTaxes
} from '$db/schema';
import { getAuthContext, apiError, apiSuccess, requireAuthorizedRid, parseJsonBody } from '$api/helpers';

export const GET: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;
	const auth = getAuthContext(event)!;

	const db = event.locals.db;

	// Resolve restaurant
	const rest = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);

	if (rest.length === 0) return apiError('Restaurant not found', 404);
	const restaurant = rest[0];

	// Get active experiences
	const activeExperiences = await db
		.select()
		.from(experiences)
		.where(and(eq(experiences.restaurantId, restaurant.id), eq(experiences.active, true)));

	const data = await Promise.all(
		activeExperiences.map(async (exp) => {
			// Prices
			const prices = await db
				.select()
				.from(experiencePrices)
				.where(eq(experiencePrices.experienceId, exp.id));

			// Add-on groups with add-ons
			const addonGroups = await db
				.select()
				.from(experienceAddOnGroups)
				.where(eq(experienceAddOnGroups.experienceId, exp.id));

			const addOnGroupsData = await Promise.all(
				addonGroups.map(async (group) => {
					const addons = await db
						.select()
						.from(experienceAddOns)
						.where(eq(experienceAddOns.groupId, group.id));

					return {
						name: group.name,
						description: group.description ?? '',
						items: addons.map((addon) => ({
							id: addon.addonId,
							name: addon.name,
							description: addon.description ?? '',
							max_per_reservation: addon.maxPerReservation ?? 20,
							price_per_item: {
								currency_code: addon.currencyCode ?? 'USD',
								min_unit_amount: addon.priceMinUnitAmount ?? 0,
								multiplier: addon.priceMultiplier ?? 100,
								service_charges:
									(addon.serviceCharges as Array<{
										serviceChargeId: number;
										label: string;
										numerator: number;
										denominator: number;
										mandatory: boolean;
										taxable: boolean;
										description: string;
									}>) ?? []
							}
						}))
					};
				})
			);

			// Total add-on count
			let totalAddOnCount = 0;
			for (const group of addOnGroupsData) {
				totalAddOnCount += group.items.length;
			}

			// Service charges (used for gratuity in price_info)
			const serviceCharges = await db
				.select()
				.from(experienceServiceCharges)
				.where(eq(experienceServiceCharges.experienceId, exp.id));

			// Taxes (not directly in this response but needed for structure)
			await db
				.select()
				.from(experienceTaxes)
				.where(eq(experienceTaxes.experienceId, exp.id));

			// Build price_info matching OpenTable spec
			const gratuity =
				serviceCharges.length > 0
					? {
							label: serviceCharges[0].label,
							numerator: serviceCharges[0].numerator,
							denominator: serviceCharges[0].denominator,
							mandatory: serviceCharges[0].mandatory ?? true,
							taxable: serviceCharges[0].taxable ?? true
						}
					: undefined;

			const priceInfo: Record<string, unknown> = {
				priceType: 'PER_PERSON',
				prePaymentRequired: exp.prepaid ?? false,
				currencyCode: exp.currency ?? 'USD',
				multiplier: exp.currencyDenominator ?? 100,
				prices: prices.map((p, idx) => {
					const entry: Record<string, unknown> = {
						priceId: p.priceId,
						priceTitle: p.title,
						priceOrder: idx + 1,
						minUnitAmount: p.price,
						priceAllInclusive: p.priceAllInclusive ?? false
					};
					if (p.description) entry.priceDescription = p.description;
					return entry;
				})
			};
			if (gratuity) {
				priceInfo.gratuity = gratuity;
			}

			// Determine add_ons_summary
			const addOnsSummary = {
				available: totalAddOnCount > 0 ? 'OPTIONAL' : 'NONE',
				count: totalAddOnCount
			};

			return {
				experience_id: exp.experienceId,
				version: exp.version,
				name: exp.name,
				description: exp.description ?? '',
				rid,
				currency: exp.currency ?? 'USD',
				bookable: exp.bookable ?? true,
				type: 'Special menu',
				type_enum: 'PRIX_FIXE',
				type_id: 2,
				price_info: priceInfo,
				add_ons: {
					groups: addOnGroupsData,
					max_per_reservation: addonGroups.length > 0 ? (addonGroups[0].maxPerReservation ?? 0) : 0
				},
				add_ons_summary: addOnsSummary
			};
		})
	);

	return apiSuccess({ data });
};

export const POST: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;
	const auth = getAuthContext(event)!;

	const db = event.locals.db;

	const parsed = await parseJsonBody<{
		experience_id: number;
		party_size_per_price_type?: Array<{ id: number; count: number }>;
		party_size?: number;
	}>(event);
	if ('error' in parsed) return parsed.error;
	const body = parsed.data;

	if (!body.experience_id) {
		return apiError('experience_id is required', 400);
	}

	// Resolve restaurant
	const rest = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);

	if (rest.length === 0) return apiError('Restaurant not found', 404);
	const restaurant = rest[0];

	// Get experience
	const exps = await db
		.select()
		.from(experiences)
		.where(
			and(
				eq(experiences.restaurantId, restaurant.id),
				eq(experiences.experienceId, body.experience_id),
				eq(experiences.active, true)
			)
		)
		.limit(1);

	if (exps.length === 0) return apiError('Experience not found', 404);
	const exp = exps[0];

	// Get prices
	const prices = await db
		.select()
		.from(experiencePrices)
		.where(eq(experiencePrices.experienceId, exp.id));

	// Calculate base subtotal
	let subtotalAmount = 0;
	if (body.party_size_per_price_type && body.party_size_per_price_type.length > 0) {
		for (const ppt of body.party_size_per_price_type) {
			const priceRecord = prices.find((p) => p.priceId === ppt.id);
			if (priceRecord) {
				subtotalAmount += priceRecord.price * ppt.count;
			}
		}
	} else if (body.party_size) {
		subtotalAmount = (exp.price ?? 0) * body.party_size;
	}

	// Service charges
	const serviceCharges = await db
		.select()
		.from(experienceServiceCharges)
		.where(eq(experienceServiceCharges.experienceId, exp.id));

	let serviceFeeAmount = 0;
	for (const sc of serviceCharges) {
		if (sc.mandatory) {
			serviceFeeAmount += Math.round((subtotalAmount * sc.numerator) / sc.denominator);
		}
	}

	// Taxes
	const taxes = await db
		.select()
		.from(experienceTaxes)
		.where(eq(experienceTaxes.experienceId, exp.id));

	let taxableAmount = subtotalAmount;
	for (const sc of serviceCharges) {
		if (sc.mandatory && sc.taxable) {
			taxableAmount += Math.round((subtotalAmount * sc.numerator) / sc.denominator);
		}
	}

	let taxesAmount = 0;
	for (const t of taxes) {
		taxesAmount += Math.round((taxableAmount * t.taxPercent) / 100);
	}

	// Tip (gratuity from mandatory service charges marked as gratuity)
	const gratuityCharge = serviceCharges.find(
		(sc) => sc.mandatory && sc.label.toLowerCase().includes('gratuity')
	);
	const tipAmount = gratuityCharge
		? Math.round((subtotalAmount * gratuityCharge.numerator) / gratuityCharge.denominator)
		: 0;

	const totalAmount = subtotalAmount + serviceFeeAmount + taxesAmount + tipAmount;

	return apiSuccess({
		subtotal_amount: subtotalAmount,
		service_fee_amount: serviceFeeAmount,
		taxes_amount: taxesAmount,
		tip_amount: tipAmount,
		total_amount: totalAmount
	});
};
