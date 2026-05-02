import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.db) {
		return { guests: [], reservations: [] };
	}

	const { getRestaurantForUser, getGuests, getReservationsForDate } = await import('$lib/server/dashboard/queries');
	const { normalizeGuest, normalizeReservation } = await import('$lib/server/dashboard/normalize');

	const restaurant = await getRestaurantForUser(locals.db, locals.user?.id ?? '');
	if (!restaurant) {
		return { guests: [], reservations: [] };
	}

	const today = new Date().toISOString().slice(0, 10);
	const [guestRows, reservationRows] = await Promise.all([
		getGuests(locals.db, restaurant.id),
		getReservationsForDate(locals.db, restaurant.id, today),
	]);
	return {
		guests: guestRows.map(normalizeGuest),
		reservations: reservationRows.map(normalizeReservation),
	};
};

export const actions: Actions = {
	updateGuest: async ({ request, locals }) => {
		if (!locals.db) return { success: false, error: 'No database' };
		const fd = await request.formData();
		const guestId = fd.get('guestId') as string;
		const { schema } = await import('$db');
		const { eq } = await import('drizzle-orm');

		const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
		const firstName = fd.get('firstName');
		if (firstName) updates.firstName = firstName;
		const lastName = fd.get('lastName');
		if (lastName) updates.lastName = lastName;
		const email = fd.get('email');
		if (email !== null) updates.email = email;
		const phone = fd.get('phone');
		if (phone !== null) updates.phone = phone;
		const notes = fd.get('notes');
		if (notes !== null) updates.notes = notes;

		await locals.db.update(schema.guests)
			.set(updates)
			.where(eq(schema.guests.id, guestId));
		return { success: true };
	},
	addTag: async ({ request, locals }) => {
		if (!locals.db) return { success: false, error: 'No database' };
		const fd = await request.formData();
		const guestId = fd.get('guestId') as string;
		const tagName = fd.get('tagName') as string;
		const { schema } = await import('$db');
		const { eq } = await import('drizzle-orm');

		// Get current guest tags and append
		const [guest] = await locals.db.select({ tags: schema.guests.tags })
			.from(schema.guests).where(eq(schema.guests.id, guestId)).limit(1);
		const currentTags = (guest?.tags as string[] | null) ?? [];
		if (!currentTags.includes(tagName)) {
			currentTags.push(tagName);
			await locals.db.update(schema.guests)
				.set({ tags: currentTags, updatedAt: new Date().toISOString() })
				.where(eq(schema.guests.id, guestId));
		}
		return { success: true };
	},
	createGuest: async ({ request, locals }) => {
		if (!locals.db) return { success: false, error: 'No database' };
		const fd = await request.formData();
		const { getRestaurantForUser, createGuest } = await import('$lib/server/dashboard/queries');
		const restaurant = await getRestaurantForUser(locals.db, locals.user?.id ?? '');
		if (!restaurant) return { success: false, error: 'No restaurant' };

		await createGuest(locals.db, restaurant.id, restaurant.rid, {
			firstName: fd.get('firstName') as string,
			lastName: fd.get('lastName') as string,
			email: (fd.get('email') as string) || undefined,
			phone: (fd.get('phone') as string) || undefined,
		});
		return { success: true };
	}
};
