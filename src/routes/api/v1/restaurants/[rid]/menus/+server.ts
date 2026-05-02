import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { restaurants, menus, menuGroups, menuItems } from '$db/schema';
import { getAuthContext, apiError, apiSuccess, requireAuthorizedRid, getRequestId, parseJsonBody } from '$api/helpers';

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

	// Fetch all menus for this restaurant
	const allMenus = await db
		.select()
		.from(menus)
		.where(eq(menus.restaurantId, restaurant.id));

	const menuResults: Array<{
		menu: {
			id: string;
			name: string;
			description: string | null;
			currency: string | null;
			updatedAt: string | null;
			ordinal: number | null;
			groups: string[];
		};
		groups: Array<{
			id: string;
			name: string;
			description?: string | null;
			ordinal: number | null;
			items: string[];
		}>;
		items: Array<{
			id: string;
			name: string;
			description?: string | null;
			ordinal: number | null;
			price?: { amount: number | null };
			tags: string[];
			modifierGroups: string[];
		}>;
	}> = [];

	for (const menu of allMenus) {
		const groups = await db
			.select()
			.from(menuGroups)
			.where(eq(menuGroups.menuId, menu.id));

		const allItems: Array<{
			id: string;
			name: string;
			description?: string | null;
			ordinal: number | null;
			price?: { amount: number | null };
			tags: string[];
			modifierGroups: string[];
		}> = [];

		const groupResults = groups.map((group) => ({
			id: group.groupId,
			name: group.name,
			description: group.description,
			ordinal: group.ordinal,
			items: [] as string[]
		}));

		for (let i = 0; i < groups.length; i++) {
			const group = groups[i];
			const items = await db
				.select()
				.from(menuItems)
				.where(eq(menuItems.groupId, group.id));

			groupResults[i].items = items.map((item) => item.itemId);

			for (const item of items) {
				allItems.push({
					id: item.itemId,
					name: item.name,
					description: item.description,
					ordinal: item.ordinal,
					...(item.priceAmount != null ? { price: { amount: item.priceAmount } } : {}),
					tags: item.tags ?? [],
					modifierGroups: (item.modifierGroups ?? []).map((mg) => mg.id)
				});
			}
		}

		menuResults.push({
			menu: {
				id: menu.menuId,
				name: menu.name,
				description: menu.description,
				currency: menu.currency,
				updatedAt: menu.updatedAt,
				ordinal: menu.ordinal,
				groups: groups.map((g) => g.groupId)
			},
			groups: groupResults,
			items: allItems
		});
	}

	return apiSuccess({
		rid,
		menus: menuResults
	});
};

interface PartnerMenuItem {
	id: string;
	name: string;
	description?: string;
	price?: { amount: number; currency: string; denominator: number };
	tags?: string[];
	modifierGroups?: Array<{
		id: string;
		name: string;
		minQuantity: number;
		maxQuantity: number;
		modifiers: Array<{ id: string; name: string; price: number }>;
	}>;
	groupId: string;
}

interface PartnerMenuGroup {
	id: string;
	name: string;
	description?: string;
	ordinal?: number;
	items: PartnerMenuItem[];
}

interface PartnerMenuPayload {
	id?: string;
	name: string;
	description?: string;
	currency?: string;
	ordinal?: number;
	groups: PartnerMenuGroup[];
}

export const POST: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;
	const auth = getAuthContext(event)!;

	const requestId = getRequestId(event);
	const db = event.locals.db;

	const parsed = await parseJsonBody<PartnerMenuPayload | PartnerMenuPayload[]>(event);
	if ('error' in parsed) return parsed.error;
	const body = parsed.data;

	// Resolve restaurant
	const rest = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);

	if (rest.length === 0) return apiError('Restaurant not found', 404);
	const restaurant = rest[0];

	const menuPayloads = Array.isArray(body) ? body : [body];
	const itemStatuses: Array<{ itemId: string; sequenceId: number; status: string }> = [];
	let sequenceCounter = 0;

	for (const menuPayload of menuPayloads) {
		if (!menuPayload.name) {
			return apiError('Menu name is required', 400);
		}

		const menuId = menuPayload.id ?? crypto.randomUUID();
		sequenceCounter++;

		// Insert menu
		await db.insert(menus).values({
			restaurantId: restaurant.id,
			rid,
			menuId,
			name: menuPayload.name,
			description: menuPayload.description ?? null,
			currency: menuPayload.currency ?? 'USD',
			ordinal: menuPayload.ordinal ?? 0
		});

		const insertedMenu = await db
			.select()
			.from(menus)
			.where(eq(menus.menuId, menuId))
			.limit(1);

		if (insertedMenu.length === 0) continue;

		itemStatuses.push({
			itemId: menuId,
			sequenceId: sequenceCounter,
			status: 'Processing'
		});

		// Insert groups and items
		for (const group of menuPayload.groups ?? []) {
			const groupId = group.id ?? crypto.randomUUID();

			await db.insert(menuGroups).values({
				menuId: insertedMenu[0].id,
				groupId,
				name: group.name,
				description: group.description ?? null,
				ordinal: group.ordinal ?? 0
			});

			const insertedGroup = await db
				.select()
				.from(menuGroups)
				.where(eq(menuGroups.groupId, groupId))
				.limit(1);

			if (insertedGroup.length === 0) continue;

			for (const item of group.items ?? []) {
				await db.insert(menuItems).values({
					groupId: insertedGroup[0].id,
					itemId: item.id ?? crypto.randomUUID(),
					name: item.name,
					description: item.description ?? null,
					ordinal: 0,
					priceAmount: item.price?.amount ?? null,
					priceCurrency: item.price?.currency ?? 'USD',
					priceDenominator: item.price?.denominator ?? 100,
					tags: item.tags ?? null,
					modifierGroups: item.modifierGroups ?? null
				});
			}
		}
	}

	return apiSuccess(
		{
			requestId,
			itemStatus: itemStatuses,
			totalItems: menuPayloads.length,
			totalProcessedItems: itemStatuses.length,
			created: new Date().toISOString()
		},
		201
	);
};
