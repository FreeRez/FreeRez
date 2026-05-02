import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.db) {
		return { tables: [], diningAreas: [] };
	}

	const { getRestaurantForUser, getTables, getDiningAreas } = await import('$lib/server/dashboard/queries');
	const { normalizeTable } = await import('$lib/server/dashboard/normalize');

	const restaurant = await getRestaurantForUser(locals.db, locals.user?.id ?? '');
	if (!restaurant) {
		return { tables: [], diningAreas: [] };
	}

	const [tableRows, diningAreaRows] = await Promise.all([
		getTables(locals.db, restaurant.id),
		getDiningAreas(locals.db, restaurant.id),
	]);
	return {
		tables: tableRows.map(normalizeTable),
		diningAreas: diningAreaRows,
	};
};

export const actions: Actions = {
	createArea: async ({ request, locals }) => {
		if (!locals.db) return { success: false, error: 'No database' };
		const fd = await request.formData();
		const { getRestaurantForUser, getMaxAreaId } = await import('$lib/server/dashboard/queries');
		const restaurant = await getRestaurantForUser(locals.db, locals.user?.id ?? '');
		if (!restaurant) return { success: false, error: 'No restaurant' };

		const { schema } = await import('$db');
		const nextAreaId = (await getMaxAreaId(locals.db, restaurant.id)) + 1;

		await locals.db.insert(schema.diningAreas).values({
			restaurantId: restaurant.id,
			areaId: nextAreaId,
			name: fd.get('name') as string,
			description: (fd.get('description') as string) || null,
			environment: (fd.get('environment') as 'Indoor' | 'Outdoor') || 'Indoor',
			active: true,
		});
		return { success: true };
	},

	deleteTable: async ({ request, locals }) => {
		if (!locals.db) return { success: false, error: 'No database' };
		const fd = await request.formData();
		const tableId = fd.get('tableId') as string;
		const { schema } = await import('$db');
		const { eq } = await import('drizzle-orm');
		await locals.db.delete(schema.tables)
			.where(eq(schema.tables.id, tableId));
		return { success: true };
	},

	createTable: async ({ request, locals }) => {
		if (!locals.db) return { success: false, error: 'No database' };
		const fd = await request.formData();
		const { getRestaurantForUser } = await import('$lib/server/dashboard/queries');
		const restaurant = await getRestaurantForUser(locals.db, locals.user?.id ?? '');
		if (!restaurant) return { success: false, error: 'No restaurant' };

		const { schema } = await import('$db');
		await locals.db.insert(schema.tables).values({
			restaurantId: restaurant.id,
			diningAreaId: (fd.get('areaId') as string) || null,
			tableNumber: fd.get('tableNumber') as string,
			minCovers: parseInt(fd.get('minCovers') as string) || 1,
			maxCovers: parseInt(fd.get('maxCovers') as string) || 4,
			shape: (fd.get('shape') as 'square' | 'round' | 'rectangle') || 'square',
			active: true,
		});
		return { success: true };
	}
};
