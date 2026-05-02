import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { restaurants, menus, menuGroups, menuItems } from '$db/schema';
import { getAuthContext, apiError, apiSuccess, requireAuthorizedRid } from '$api/helpers';

export const GET: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;
	const auth = getAuthContext(event)!;

	const menuId = event.params.menu_id;
	if (!menuId) return apiError('Menu ID is required', 400);

	const db = event.locals.db;

	// Resolve restaurant
	const rest = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);

	if (rest.length === 0) return apiError('Restaurant not found', 404);
	const restaurant = rest[0];

	// Fetch the specific menu
	const menuResult = await db
		.select()
		.from(menus)
		.where(and(eq(menus.restaurantId, restaurant.id), eq(menus.menuId, menuId)))
		.limit(1);

	if (menuResult.length === 0) return apiError('Menu not found', 404);
	const menu = menuResult[0];

	// Fetch groups
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

	return apiSuccess({
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
};
