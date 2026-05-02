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

interface AddOnRequest {
	item_id: string;
	quantity: number;
}

interface PartySizePerPriceType {
	id: number;
	count: number;
}

export const POST: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;
	const auth = getAuthContext(event)!;

	const db = event.locals.db;

	const parsed = await parseJsonBody<{
		experience_id: number;
		version: number;
		party_size: number;
		tip_percent_list?: number[];
		add_ons?: AddOnRequest[];
		party_size_per_price_type?: PartySizePerPriceType[];
	}>(event);
	if ('error' in parsed) return parsed.error;
	const body = parsed.data;

	if (!body.experience_id || !body.party_size) {
		return apiError('experience_id and party_size are required', 400);
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

	const denominator = exp.currencyDenominator ?? 100;
	const currency = exp.currency ?? 'USD';

	// Get prices
	const prices = await db
		.select()
		.from(experiencePrices)
		.where(eq(experiencePrices.experienceId, exp.id));

	// Get service charges
	const serviceCharges = await db
		.select()
		.from(experienceServiceCharges)
		.where(eq(experienceServiceCharges.experienceId, exp.id));

	// Get taxes
	const taxes = await db
		.select()
		.from(experienceTaxes)
		.where(eq(experienceTaxes.experienceId, exp.id));

	// Calculate per-price-type subtotals
	const partyPerPrice = body.party_size_per_price_type ?? [];
	const subtotalsPerPriceType: Array<{
		id: number;
		count: number;
		price: number;
		subtotal: number;
		price_all_inclusive: boolean;
		subtotal_with_tax_and_fees: number;
	}> = [];

	let itemSubtotalAmount = 0;
	for (const ppt of partyPerPrice) {
		const priceRecord = prices.find((p) => p.priceId === ppt.id);
		if (priceRecord) {
			const subtotal = priceRecord.price * ppt.count;
			itemSubtotalAmount += subtotal;
			subtotalsPerPriceType.push({
				id: ppt.id,
				count: ppt.count,
				price: priceRecord.price,
				subtotal,
				price_all_inclusive: priceRecord.priceAllInclusive ?? false,
				subtotal_with_tax_and_fees: 0 // calculated after taxes
			});
		}
	}

	// If no per-price-type, use default price
	if (partyPerPrice.length === 0) {
		itemSubtotalAmount = (exp.price ?? 0) * body.party_size;
	}

	// Calculate add-on totals
	let addonSubtotal = 0;
	const addOnResults: Array<Record<string, unknown>> = [];

	if (body.add_ons && body.add_ons.length > 0) {
		const addonGroups = await db
			.select()
			.from(experienceAddOnGroups)
			.where(eq(experienceAddOnGroups.experienceId, exp.id));

		for (const reqAddon of body.add_ons) {
			for (const group of addonGroups) {
				const addons = await db
					.select()
					.from(experienceAddOns)
					.where(
						and(
							eq(experienceAddOns.groupId, group.id),
							eq(experienceAddOns.addonId, reqAddon.item_id)
						)
					)
					.limit(1);

				if (addons.length > 0) {
					const addon = addons[0];
					const unitPrice = addon.priceMinUnitAmount ?? 0;
					const lineTotal = unitPrice * reqAddon.quantity;
					addonSubtotal += lineTotal;

					addOnResults.push({
						item_id: addon.addonId,
						name: addon.name,
						quantity: reqAddon.quantity,
						price: unitPrice,
						line_total: lineTotal
					});
					break;
				}
			}
		}
	}

	// Calculate service fees per price type
	let totalServiceFeeAmount = 0;
	const serviceFeeSubtotalsPerPriceType: Array<Record<string, unknown>> = [];

	for (const ppt of subtotalsPerPriceType) {
		let feeForPrice = 0;
		for (const sc of serviceCharges) {
			if (sc.mandatory) {
				const feeAmount = Math.round((ppt.subtotal * sc.numerator) / sc.denominator);
				feeForPrice += feeAmount;
				serviceFeeSubtotalsPerPriceType.push({
					fee_percent: Math.round((sc.numerator / sc.denominator) * 100),
					fee_amount: feeAmount,
					label: sc.label,
					description: sc.description ?? '',
					mandatory: sc.mandatory ?? true,
					taxable: sc.taxable ?? true
				});
			}
		}
		totalServiceFeeAmount += feeForPrice;
	}

	// If no per-price breakdown, calculate on total
	if (subtotalsPerPriceType.length === 0 && serviceCharges.length > 0) {
		for (const sc of serviceCharges) {
			if (sc.mandatory) {
				const amount = Math.round((itemSubtotalAmount * sc.numerator) / sc.denominator);
				totalServiceFeeAmount += amount;
			}
		}
	}

	// Calculate taxes
	let taxesOnItemAmount = 0;
	let taxesOnServiceFeesAmount = 0;
	let taxesOnTipAmount = 0;
	let taxesOnAddOnsAmount = 0;

	const taxSubtotalsPerPriceType: Array<Record<string, unknown>> = [];

	for (const ppt of subtotalsPerPriceType) {
		for (const t of taxes) {
			const taxOnItem = Math.round((ppt.subtotal * t.taxPercent) / 100);
			taxesOnItemAmount += taxOnItem;

			// Tax on service fees for this price type
			let taxOnServiceFees = 0;
			const taxOnServiceFeesDetails: Array<Record<string, unknown>> = [];
			for (const sc of serviceCharges) {
				if (sc.taxable && sc.mandatory) {
					const scAmount = Math.round((ppt.subtotal * sc.numerator) / sc.denominator);
					const taxOnSc = Math.round((scAmount * t.taxPercent) / 100);
					taxOnServiceFees += taxOnSc;
					taxesOnServiceFeesAmount += taxOnSc;
					taxOnServiceFeesDetails.push({
						service_fee_id: sc.serviceChargeId,
						tax_amount: taxOnSc
					});
				}
			}

			taxSubtotalsPerPriceType.push({
				id: ppt.id,
				tax_percent: t.taxPercent,
				tax_on_item_amount: taxOnItem,
				tax_on_service_fees_amount: taxOnServiceFees,
				tax_on_service_fees: taxOnServiceFeesDetails,
				tax_subtotal: taxOnItem + taxOnServiceFees,
				tax_id: t.taxId,
				label: t.label ?? 'Tax'
			});

			// Update subtotal_with_tax_and_fees
			const serviceFeeForPpt = serviceCharges
				.filter((s) => s.mandatory)
				.reduce((sum, s) => sum + Math.round((ppt.subtotal * s.numerator) / s.denominator), 0);
			ppt.subtotal_with_tax_and_fees =
				ppt.subtotal +
				serviceFeeForPpt +
				taxOnItem +
				taxOnServiceFees;
		}
	}

	// Tax on add-ons
	for (const t of taxes) {
		const taxOnAddOns = Math.round((addonSubtotal * t.taxPercent) / 100);
		taxesOnAddOnsAmount += taxOnAddOns;
	}

	// If no per-price breakdown
	if (subtotalsPerPriceType.length === 0) {
		for (const t of taxes) {
			taxesOnItemAmount += Math.round((itemSubtotalAmount * t.taxPercent) / 100);
			taxesOnServiceFeesAmount += Math.round((totalServiceFeeAmount * t.taxPercent) / 100);
		}
	}

	const totalTaxesAmount = taxesOnItemAmount + taxesOnServiceFeesAmount + taxesOnAddOnsAmount;

	// Build totals per tip percent
	const tipPercentList = body.tip_percent_list ?? [15, 18, 20, 22, 25];
	const isTipMandatory = exp.hasMandatoryTip ?? false;
	const isTipTaxable = exp.isTipTaxable ?? false;

	const totals = tipPercentList.map((tipPercent) => {
		const tipBase = itemSubtotalAmount + addonSubtotal;
		const tipAmount = Math.round((tipBase * tipPercent) / 100);
		const taxesOnTip = isTipTaxable
			? taxes.reduce((sum, t) => sum + Math.round((tipAmount * t.taxPercent) / 100), 0)
			: 0;
		const tipAmountWithTaxes = tipAmount + taxesOnTip;

		const totalAmount =
			itemSubtotalAmount +
			addonSubtotal +
			totalServiceFeeAmount +
			totalTaxesAmount +
			tipAmountWithTaxes;

		return {
			tip_amount: tipAmount,
			tip_percent: tipPercent,
			tip_amount_with_taxes: tipAmountWithTaxes,
			service_fee_amount: totalServiceFeeAmount,
			add_on_subtotal_amount_with_taxes: addonSubtotal + taxesOnAddOnsAmount,
			add_on_subtotal: addonSubtotal,
			item_subtotal_amount: itemSubtotalAmount,
			taxes_on_tip_amount: taxesOnTip,
			taxes_on_service_fees_amount: taxesOnServiceFeesAmount,
			taxes_amount: totalTaxesAmount + taxesOnTip,
			total_amount: totalAmount,
			taxes_on_item_amount: taxesOnItemAmount,
			taxes_on_add_ons_amount: taxesOnAddOnsAmount,
			item_subtotal_amount_without_taxes: itemSubtotalAmount,
			is_tip_mandatory: isTipMandatory,
			subtotals_per_price_type: subtotalsPerPriceType,
			taxes: taxes.map((t) => ({
				tax_id: t.taxId,
				tax_percent: t.taxPercent,
				tax_on_item_amount: taxesOnItemAmount,
				tax_on_tip_amount: taxesOnTip,
				tax_on_service_fees_amount: taxesOnServiceFeesAmount,
				tax_subtotals_per_price_type: taxSubtotalsPerPriceType.filter(
					(ts) => ts.tax_id === t.taxId
				),
				tax_subtotal: totalTaxesAmount,
				tax_total: totalTaxesAmount + taxesOnTip
			}))
		};
	});

	// Build service_fees array
	const serviceFees = serviceCharges.map((sc) => {
		const feeAmount = Math.round((itemSubtotalAmount * sc.numerator) / sc.denominator);
		const feePercent = Math.round((sc.numerator / sc.denominator) * 100);
		return {
			label: sc.label,
			fee_percent: feePercent,
			fee_amount: feeAmount,
			taxable: sc.taxable ?? true,
			service_fee_subtotals_per_price_type: subtotalsPerPriceType.map((ppt) => ({
				fee_percent: feePercent,
				fee_amount: Math.round((ppt.subtotal * sc.numerator) / sc.denominator),
				label: sc.label,
				description: sc.description ?? '',
				mandatory: sc.mandatory ?? true,
				taxable: sc.taxable ?? true
			})),
			fee_amount_for_add_ons: 0,
			fee_amount_without_add_ons: feeAmount
		};
	});

	// Build prices array
	const pricesResponse = prices.map((p, idx) => ({
		id: p.priceId,
		title: p.title,
		description: p.description ?? '',
		price: p.price,
		price_all_inclusive: p.priceAllInclusive ?? false,
		price_order: idx + 1
	}));

	return apiSuccess({
		id: exp.experienceId,
		version: exp.version,
		add_ons: addOnResults,
		currency,
		currency_denominator: denominator,
		totals,
		has_mandatory_tip: isTipMandatory,
		is_tip_taxable: isTipTaxable,
		prices: pricesResponse,
		restaurant_id: rid,
		booking_type: 'Table',
		ticketed: false,
		service_fees: serviceFees
	});
};
