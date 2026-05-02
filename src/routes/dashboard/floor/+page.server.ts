import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.db) {
		return { tables: [], reservations: [], sections: [], servers: [], layouts: [], activeLayoutId: null };
	}

	const { getRestaurantForUser, getTables, getReservationsForDate, getSectionsForDate, getStaffServers, getFloorPlanLayouts, getFloorPlanLayout } = await import('$lib/server/dashboard/queries');
	const { normalizeTable, normalizeReservation, normalizeSection } = await import('$lib/server/dashboard/normalize');

	const restaurant = await getRestaurantForUser(locals.db, locals.user?.id ?? '');
	if (!restaurant) {
		return { tables: [], reservations: [], sections: [], servers: [], layouts: [], activeLayoutId: null };
	}

	const today = new Date().toISOString().slice(0, 10);
	const [rawTables, rawReservations, rawSections, servers, layouts] = await Promise.all([
		getTables(locals.db, restaurant.id),
		getReservationsForDate(locals.db, restaurant.id, today),
		getSectionsForDate(locals.db, restaurant.id, today),
		getStaffServers(locals.db, restaurant.id),
		getFloorPlanLayouts(locals.db, restaurant.id),
	]);

	let savedLayout = restaurant.floorPlanLayout as { floors?: unknown[]; tables?: unknown[] } | null;
	if (restaurant.activeLayoutId) {
		const activeLayout = await getFloorPlanLayout(locals.db, restaurant.activeLayoutId);
		if (activeLayout?.layoutData) {
			savedLayout = activeLayout.layoutData as { floors?: unknown[]; tables?: unknown[] };
		}
	}

	return {
		tables: rawTables.map(normalizeTable),
		reservations: rawReservations.map(normalizeReservation),
		sections: rawSections.map(normalizeSection),
		servers,
		layouts,
		activeLayoutId: restaurant.activeLayoutId ?? null,
		savedLayout,
	};
};

export const actions: Actions = {
	blockTable: async ({ request, locals }) => {
		if (!locals.db) return { success: false, error: 'No database' };
		const fd = await request.formData();
		const tableNumber = fd.get('tableNumber') as string;
		const { schema } = await import('$db');
		const { eq, and } = await import('drizzle-orm');
		const { getRestaurantForUser } = await import('$lib/server/dashboard/queries');
		const restaurant = await getRestaurantForUser(locals.db, locals.user?.id ?? '');
		if (!restaurant) return { success: false, error: 'No restaurant' };

		await locals.db.update(schema.tables)
			.set({ status: 'blocked' })
			.where(and(
				eq(schema.tables.restaurantId, restaurant.id),
				eq(schema.tables.tableNumber, tableNumber)
			));
		return { success: true };
	},
	unblockTable: async ({ request, locals }) => {
		if (!locals.db) return { success: false, error: 'No database' };
		const fd = await request.formData();
		const tableNumber = fd.get('tableNumber') as string;
		const { schema } = await import('$db');
		const { eq, and } = await import('drizzle-orm');
		const { getRestaurantForUser } = await import('$lib/server/dashboard/queries');
		const restaurant = await getRestaurantForUser(locals.db, locals.user?.id ?? '');
		if (!restaurant) return { success: false, error: 'No restaurant' };

		await locals.db.update(schema.tables)
			.set({ status: 'available' })
			.where(and(
				eq(schema.tables.restaurantId, restaurant.id),
				eq(schema.tables.tableNumber, tableNumber)
			));
		return { success: true };
	},
	createSection: async ({ request, locals }) => {
		if (!locals.db) return { success: false, error: 'No database' };
		const fd = await request.formData();
		const { schema } = await import('$db');
		const { getRestaurantForUser } = await import('$lib/server/dashboard/queries');
		const restaurant = await getRestaurantForUser(locals.db, locals.user?.id ?? '');
		if (!restaurant) return { success: false, error: 'No restaurant' };

		const tableIds: string[] = JSON.parse(fd.get('tableIds') as string || '[]');
		const sectionId = crypto.randomUUID();
		await locals.db.insert(schema.serverSections).values({
			id: sectionId,
			restaurantId: restaurant.id,
			staffId: fd.get('staffId') as string,
			shiftId: fd.get('shiftId') as string || null,
			date: fd.get('date') as string,
			name: fd.get('name') as string,
			color: fd.get('color') as string,
			active: true,
		});
		if (tableIds.length > 0) {
			await locals.db.insert(schema.serverSectionTables).values(
				tableIds.map(tableId => ({ sectionId, tableId }))
			);
		}
		return { success: true, sectionId };
	},
	updateSection: async ({ request, locals }) => {
		if (!locals.db) return { success: false, error: 'No database' };
		const fd = await request.formData();
		const { schema } = await import('$db');
		const { eq } = await import('drizzle-orm');
		const sectionId = fd.get('sectionId') as string;

		const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
		if (fd.has('name')) updates.name = fd.get('name');
		if (fd.has('staffId')) updates.staffId = fd.get('staffId');
		if (fd.has('color')) updates.color = fd.get('color');

		await locals.db.update(schema.serverSections).set(updates).where(eq(schema.serverSections.id, sectionId));

		if (fd.has('tableIds')) {
			const tableIds: string[] = JSON.parse(fd.get('tableIds') as string || '[]');
			await locals.db.delete(schema.serverSectionTables).where(eq(schema.serverSectionTables.sectionId, sectionId));
			if (tableIds.length > 0) {
				await locals.db.insert(schema.serverSectionTables).values(
					tableIds.map(tableId => ({ sectionId, tableId }))
				);
			}
		}
		return { success: true };
	},
	deleteSection: async ({ request, locals }) => {
		if (!locals.db) return { success: false, error: 'No database' };
		const fd = await request.formData();
		const { schema } = await import('$db');
		const { eq } = await import('drizzle-orm');
		await locals.db.delete(schema.serverSections).where(eq(schema.serverSections.id, fd.get('sectionId') as string));
		return { success: true };
	},
	saveLayout: async ({ request, locals }) => {
		if (!locals.db) return { success: false, error: 'No database' };
		const fd = await request.formData();
		const layoutJson = fd.get('layout') as string;
		if (!layoutJson) return { success: false, error: 'No layout data' };

		const { schema } = await import('$db');
		const { eq, and } = await import('drizzle-orm');
		const { getRestaurantForUser, getDiningAreas } = await import('$lib/server/dashboard/queries');
		const restaurant = await getRestaurantForUser(locals.db, locals.user?.id ?? '');
		if (!restaurant) return { success: false, error: 'No restaurant' };

		const layoutData = JSON.parse(layoutJson);
		const now = new Date().toISOString();

		// Save layout JSON blob (for geometry: walls, doors, fixtures, positions)
		await locals.db.update(schema.restaurants)
			.set({ floorPlanLayout: layoutData, updatedAt: now })
			.where(eq(schema.restaurants.id, restaurant.id));

		if (restaurant.activeLayoutId) {
			await locals.db.update(schema.floorPlanLayouts)
				.set({ layoutData, updatedAt: now })
				.where(eq(schema.floorPlanLayouts.id, restaurant.activeLayoutId));
		}

		// Sync tables from layout to DB
		const layoutTables = (layoutData.tables ?? []) as Array<{
			id: string; area?: string; shape?: string; seats?: number;
			x?: number; y?: number; status?: string;
		}>;

		if (layoutTables.length > 0) {
			const areas = await getDiningAreas(locals.db, restaurant.id);
			const areaNameMap = new Map(areas.map(a => [a.name, a.id]));

			const existingTables = await locals.db.select({ id: schema.tables.id, tableNumber: schema.tables.tableNumber })
				.from(schema.tables)
				.where(eq(schema.tables.restaurantId, restaurant.id));
			const existingMap = new Map(existingTables.map(t => [t.tableNumber, t.id]));

			const shapeMap: Record<string, 'square' | 'round' | 'rectangle'> = {
				round: 'round',
				rect: 'square',
			};

			const layoutTableIds = new Set(layoutTables.map(t => t.id));

			for (const lt of layoutTables) {
				const dbShape = shapeMap[lt.shape ?? 'rect'] ?? 'square';
				const diningAreaId = lt.area ? (areaNameMap.get(lt.area) ?? null) : null;
				const existing = existingMap.get(lt.id);

				if (existing) {
					await locals.db.update(schema.tables).set({
						maxCovers: lt.seats ?? 2,
						positionX: lt.x ?? 0,
						positionY: lt.y ?? 0,
						shape: dbShape,
						diningAreaId,
						status: (lt.status as any) ?? 'available',
					}).where(eq(schema.tables.id, existing));
				} else {
					await locals.db.insert(schema.tables).values({
						id: crypto.randomUUID(),
						restaurantId: restaurant.id,
						tableNumber: lt.id,
						minCovers: 1,
						maxCovers: lt.seats ?? 2,
						positionX: lt.x ?? 0,
						positionY: lt.y ?? 0,
						shape: dbShape,
						diningAreaId,
						status: (lt.status as any) ?? 'available',
						active: true,
					});
				}
			}

			// Deactivate tables removed from the layout
			for (const [tableNumber, tableId] of existingMap) {
				if (!layoutTableIds.has(tableNumber)) {
					await locals.db.update(schema.tables).set({ active: false }).where(eq(schema.tables.id, tableId));
				}
			}
		}

		return { success: true };
	},
	saveLayoutAs: async ({ request, locals }) => {
		if (!locals.db) return { success: false, error: 'No database' };
		const fd = await request.formData();
		const { schema } = await import('$db');
		const { eq } = await import('drizzle-orm');
		const { getRestaurantForUser } = await import('$lib/server/dashboard/queries');
		const restaurant = await getRestaurantForUser(locals.db, locals.user?.id ?? '');
		if (!restaurant) return { success: false, error: 'No restaurant' };

		const name = fd.get('name') as string;
		const layoutJson = fd.get('layout') as string;
		if (!name || !layoutJson) return { success: false, error: 'Missing name or layout' };

		const layoutId = crypto.randomUUID();
		const now = new Date().toISOString();
		await locals.db.insert(schema.floorPlanLayouts).values({
			id: layoutId,
			restaurantId: restaurant.id,
			name,
			layoutData: JSON.parse(layoutJson),
			isDefault: false,
			createdAt: now,
			updatedAt: now,
		});

		await locals.db.update(schema.restaurants)
			.set({ activeLayoutId: layoutId, floorPlanLayout: JSON.parse(layoutJson), updatedAt: now })
			.where(eq(schema.restaurants.id, restaurant.id));

		return { success: true, layoutId };
	},
	switchLayout: async ({ request, locals }) => {
		if (!locals.db) return { success: false, error: 'No database' };
		const fd = await request.formData();
		const { schema } = await import('$db');
		const { eq } = await import('drizzle-orm');
		const { getRestaurantForUser, getFloorPlanLayout } = await import('$lib/server/dashboard/queries');
		const restaurant = await getRestaurantForUser(locals.db, locals.user?.id ?? '');
		if (!restaurant) return { success: false, error: 'No restaurant' };

		const layoutId = fd.get('layoutId') as string;
		const layout = await getFloorPlanLayout(locals.db, layoutId);
		if (!layout) return { success: false, error: 'Layout not found' };

		const now = new Date().toISOString();
		await locals.db.update(schema.restaurants)
			.set({
				activeLayoutId: layoutId,
				floorPlanLayout: layout.layoutData,
				updatedAt: now,
			})
			.where(eq(schema.restaurants.id, restaurant.id));

		return { success: true };
	},
	deleteLayout: async ({ request, locals }) => {
		if (!locals.db) return { success: false, error: 'No database' };
		const fd = await request.formData();
		const { schema } = await import('$db');
		const { eq } = await import('drizzle-orm');
		const { getRestaurantForUser } = await import('$lib/server/dashboard/queries');
		const restaurant = await getRestaurantForUser(locals.db, locals.user?.id ?? '');
		if (!restaurant) return { success: false, error: 'No restaurant' };

		const layoutId = fd.get('layoutId') as string;
		if (restaurant.activeLayoutId === layoutId) {
			await locals.db.update(schema.restaurants)
				.set({ activeLayoutId: null })
				.where(eq(schema.restaurants.id, restaurant.id));
		}
		await locals.db.delete(schema.floorPlanLayouts).where(eq(schema.floorPlanLayouts.id, layoutId));
		return { success: true };
	},
};
