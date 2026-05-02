import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.db) {
		return { reservations: [], guests: [], tableCount: 0, lastWeekCovers: 0, shifts: [] };
	}

	const { getRestaurantForUser, getReservationsForDate, getGuests, getTables, getShifts } = await import('$lib/server/dashboard/queries');
	const { normalizeReservation, normalizeGuest } = await import('$lib/server/dashboard/normalize');

	const restaurant = await getRestaurantForUser(locals.db, locals.user?.id ?? '');
	if (!restaurant) {
		return { reservations: [], guests: [], tableCount: 0, lastWeekCovers: 0, shifts: [] };
	}

	const today = new Date();
	const todayStr = today.toISOString().slice(0, 10);
	const lastWeek = new Date(today);
	lastWeek.setDate(lastWeek.getDate() - 7);
	const lastWeekStr = lastWeek.toISOString().slice(0, 10);

	const [rawReservations, rawGuests, tables, lastWeekReservations, shifts] = await Promise.all([
		getReservationsForDate(locals.db, restaurant.id, todayStr),
		getGuests(locals.db, restaurant.id),
		getTables(locals.db, restaurant.id),
		getReservationsForDate(locals.db, restaurant.id, lastWeekStr),
		getShifts(locals.db, restaurant.id),
	]);

	const activeTables = tables.filter(t => t.active !== false);
	const lastWeekCovers = lastWeekReservations.reduce((s, r) => s + r.partySize, 0);

	return {
		reservations: rawReservations.map(normalizeReservation),
		guests: rawGuests.map(normalizeGuest),
		tableCount: activeTables.length,
		lastWeekCovers,
		shifts: shifts.map(s => ({ startTime: s.startTime, endTime: s.endTime, dayOfWeek: s.dayOfWeek, name: s.name })),
	};
};
