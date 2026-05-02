import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import {
	restaurants,
	experiences,
	experiencePrices,
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
			const prices = await db
				.select()
				.from(experiencePrices)
				.where(eq(experiencePrices.experienceId, exp.id));

			const serviceCharges = await db
				.select()
				.from(experienceServiceCharges)
				.where(eq(experienceServiceCharges.experienceId, exp.id));

			// Build gratuity from mandatory service charges
			const mandatoryTipCharge = serviceCharges.find(
				(sc) => sc.mandatory && sc.label.toLowerCase().includes('gratuity')
			);

			const gratuity = mandatoryTipCharge
				? {
						label: mandatoryTipCharge.label,
						numerator: mandatoryTipCharge.numerator,
						denominator: mandatoryTipCharge.denominator,
						mandatory: mandatoryTipCharge.mandatory ?? true,
						taxable: mandatoryTipCharge.taxable ?? false
					}
				: undefined;

			// Build price_info per spec
			const priceInfo: {
				price_type: string;
				prepayment_required: boolean;
				currency_code: string;
				multiplier: number;
				gratuity?: {
					label: string;
					numerator: number;
					denominator: number;
					mandatory: boolean;
					taxable: boolean;
				};
				prices: Array<{
					price_id: number;
					price_title?: string;
					min_unit_amount: number;
					price_all_inclusive: boolean;
				}>;
			} = {
				price_type: prices.length > 0 ? 'PER_PERSON' : 'PER_PARTY',
				prepayment_required: exp.prepaid ?? false,
				currency_code: exp.currency ?? 'USD',
				multiplier: exp.currencyDenominator ?? 100,
				prices: prices.map((p) => ({
					price_id: p.priceId,
					...(p.title ? { price_title: p.title } : {}),
					min_unit_amount: p.price,
					price_all_inclusive: p.priceAllInclusive ?? false
				}))
			};

			if (gratuity) {
				priceInfo.gratuity = gratuity;
			}

			return {
				bookable: exp.bookable ?? true,
				currency: exp.currency ?? 'USD',
				description: exp.description ?? '',
				experience_id: exp.experienceId,
				name: exp.name,
				rid,
				version: exp.version,
				price_info: priceInfo
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
