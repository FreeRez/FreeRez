import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.db) {
		return { shifts: [] };
	}

	const { getRestaurantForUser, getShifts } = await import('$lib/server/dashboard/queries');
	const { normalizeShift } = await import('$lib/server/dashboard/normalize');

	const restaurant = await getRestaurantForUser(locals.db, locals.user?.id ?? '');
	if (!restaurant) {
		return { shifts: [] };
	}

	const shiftRows = await getShifts(locals.db, restaurant.id);
	return {
		shifts: shiftRows.map(normalizeShift),
	};
};

export const actions: Actions = {
	createShift: async ({ request, locals }) => {
		if (!locals.db) return { success: false, error: 'No database' };
		const fd = await request.formData();
		const { getRestaurantForUser } = await import('$lib/server/dashboard/queries');
		const restaurant = await getRestaurantForUser(locals.db, locals.user?.id ?? '');
		if (!restaurant) return { success: false, error: 'No restaurant' };

		const { schema } = await import('$db');
		await locals.db.insert(schema.shifts).values({
			restaurantId: restaurant.id,
			name: fd.get('name') as string,
			dayOfWeek: parseInt(fd.get('dayOfWeek') as string) || 1,
			startTime: fd.get('startTime') as string,
			endTime: fd.get('endTime') as string,
			slotIntervalMinutes: parseInt(fd.get('interval') as string) || 15,
			maxCoversPerSlot: parseInt(fd.get('maxCovers') as string) || 60,
			active: true,
		});
		return { success: true };
	}
};
