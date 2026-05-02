import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.db) {
		return { experiences: [] };
	}

	const { getRestaurantForUser, getExperiences } = await import('$lib/server/dashboard/queries');
	const { normalizeExperience } = await import('$lib/server/dashboard/normalize');

	const restaurant = await getRestaurantForUser(locals.db, locals.user?.id ?? '');
	if (!restaurant) {
		return { experiences: [] };
	}

	const expRows = await getExperiences(locals.db, restaurant.id);
	return {
		experiences: expRows.map(normalizeExperience),
	};
};

export const actions: Actions = {
	updateExperience: async ({ request, locals }) => {
		if (!locals.db) return { success: false, error: 'No database' };
		const fd = await request.formData();
		const experienceId = fd.get('experienceId') as string;
		const { schema } = await import('$db');
		const { eq } = await import('drizzle-orm');

		const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
		const name = fd.get('name');
		if (name) updates.name = name;
		const description = fd.get('description');
		if (description !== null) updates.description = description;
		const price = fd.get('price');
		if (price) updates.price = parseInt(price as string);
		const prepaid = fd.get('prepaid');
		if (prepaid !== null) updates.prepaid = prepaid === 'true';

		await locals.db.update(schema.experiences)
			.set(updates)
			.where(eq(schema.experiences.id, experienceId));
		return { success: true };
	},
	createExperience: async ({ request, locals }) => {
		if (!locals.db) return { success: false, error: 'No database' };
		const fd = await request.formData();
		const { getRestaurantForUser } = await import('$lib/server/dashboard/queries');
		const restaurant = await getRestaurantForUser(locals.db, locals.user?.id ?? '');
		if (!restaurant) return { success: false, error: 'No restaurant' };

		const { schema } = await import('$db');
		const nextId = Math.floor(Math.random() * 1000000);
		await locals.db.insert(schema.experiences).values({
			restaurantId: restaurant.id,
			experienceId: nextId,
			name: fd.get('name') as string,
			description: (fd.get('description') as string) || null,
			price: parseInt(fd.get('price') as string) || 0,
			prepaid: fd.get('prepaid') === 'true',
			active: true,
		});
		return { success: true };
	}
};
