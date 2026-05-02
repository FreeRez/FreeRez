import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const empty = { reservations: [], servers: [], tables: [], shifts: [], diningAreas: [] as Array<{ id: string; name: string }> };
	if (!locals.db) return empty;

	const { getRestaurantForUser, getReservationsForDate, getStaffServers, getTables, getShifts, getDiningAreas } = await import('$lib/server/dashboard/queries');
	const { normalizeReservation, normalizeTable, normalizeShift } = await import('$lib/server/dashboard/normalize');

	const restaurant = await getRestaurantForUser(locals.db, locals.user?.id ?? '');
	if (!restaurant) return empty;

	const today = new Date().toISOString().slice(0, 10);
	const [rawReservations, servers, rawTables, rawShifts, rawAreas] = await Promise.all([
		getReservationsForDate(locals.db, restaurant.id, today),
		getStaffServers(locals.db, restaurant.id),
		getTables(locals.db, restaurant.id),
		getShifts(locals.db, restaurant.id),
		getDiningAreas(locals.db, restaurant.id),
	]);

	return {
		reservations: rawReservations.map(normalizeReservation),
		servers,
		tables: rawTables.filter(t => t.active !== false).map(normalizeTable),
		shifts: rawShifts.map(normalizeShift),
		diningAreas: rawAreas.map(a => ({ id: a.id, name: a.name })),
	};
};

export const actions: Actions = {
	updateStatus: async ({ request, locals }) => {
		if (!locals.db) return { success: false, error: 'No database' };
		const formData = await request.formData();
		const reservationId = formData.get('reservationId') as string;
		const newState = formData.get('state') as string;
		const { updateReservationState } = await import('$lib/server/dashboard/queries');
		await updateReservationState(locals.db, reservationId, newState as any);
		return { success: true };
	},
	updateReservation: async ({ request, locals }) => {
		if (!locals.db) return { success: false, error: 'No database' };
		const fd = await request.formData();
		const reservationId = fd.get('reservationId') as string;
		const { schema } = await import('$db');
		const { eq } = await import('drizzle-orm');

		const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
		const partySize = fd.get('partySize');
		if (partySize) updates.partySize = parseInt(partySize as string);
		const server = fd.get('server');
		if (server) updates.server = server;
		const guestRequest = fd.get('guestRequest');
		if (guestRequest !== null) updates.guestRequest = guestRequest;
		const scheduledTime = fd.get('scheduledTime');
		if (scheduledTime) updates.scheduledTime = scheduledTime;
		const tableNumber = fd.get('tableNumber');
		if (tableNumber) updates.tableNumber = JSON.parse(tableNumber as string);

		await locals.db.update(schema.reservations)
			.set(updates)
			.where(eq(schema.reservations.id, reservationId));
		return { success: true };
	},
	create: async ({ request, locals }) => {
		if (!locals.db) return { success: false, error: 'No database' };
		const formData = await request.formData();
		const { getRestaurantForUser, createGuest, createReservation } = await import('$lib/server/dashboard/queries');
		const restaurant = await getRestaurantForUser(locals.db, locals.user?.id ?? '');
		if (!restaurant) return { success: false, error: 'No restaurant' };

		// Create or find guest
		let guestId: string | undefined;
		const firstName = formData.get('firstName') as string;
		const lastName = formData.get('lastName') as string;
		if (firstName && lastName) {
			const guest = await createGuest(locals.db, restaurant.id, restaurant.rid, {
				firstName,
				lastName,
				email: formData.get('email') as string || undefined,
				phone: formData.get('phone') as string || undefined,
			});
			guestId = guest.id;
		}

		const date = formData.get('date') as string;
		const time = formData.get('time') as string;
		const scheduledTime = `${date}T${time}:00`;

		const tableNumber = formData.get('tableNumber') as string | null;
		let serverName: string | undefined;
		if (tableNumber) {
			const { schema } = await import('$db');
			const { eq, and } = await import('drizzle-orm');
			const tableRow = await locals.db.select({ id: schema.tables.id })
				.from(schema.tables)
				.where(and(eq(schema.tables.restaurantId, restaurant.id), eq(schema.tables.tableNumber, tableNumber)))
				.limit(1);
			if (tableRow.length > 0) {
				const { getServerForTable } = await import('$lib/server/dashboard/queries');
				serverName = (await getServerForTable(locals.db, tableRow[0].id, date)) ?? undefined;
			}
		}

		await createReservation(locals.db, restaurant.id, restaurant.rid, {
			guestId,
			partySize: parseInt(formData.get('partySize') as string) || 2,
			scheduledTime,
			guestRequest: formData.get('specialRequest') as string || undefined,
			server: serverName,
			tableNumber: tableNumber ? [tableNumber] : undefined,
			origin: 'Phone/In-house',
		});

		return { success: true };
	}
};
