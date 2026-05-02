import type { PageServerLoad, Actions } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.db) return { valid: false, error: 'unavailable' };

	const { schema } = await import('$db');
	const { eq } = await import('drizzle-orm');

	const [staff] = await locals.db.select({
		id: schema.restaurantStaff.id,
		restaurantId: schema.restaurantStaff.restaurantId,
		userId: schema.restaurantStaff.userId,
		role: schema.restaurantStaff.role,
		active: schema.restaurantStaff.active,
		inviteExpiresAt: schema.restaurantStaff.inviteExpiresAt,
		userName: schema.users.name,
		userEmail: schema.users.email,
		restaurantName: schema.restaurants.name,
	})
		.from(schema.restaurantStaff)
		.leftJoin(schema.users, eq(schema.restaurantStaff.userId, schema.users.id))
		.leftJoin(schema.restaurants, eq(schema.restaurantStaff.restaurantId, schema.restaurants.id))
		.where(eq(schema.restaurantStaff.inviteToken, params.token))
		.limit(1);

	if (!staff) return { valid: false, error: 'not_found' };
	if (staff.active) return { valid: false, error: 'already_accepted' };

	const expires = staff.inviteExpiresAt ? new Date(staff.inviteExpiresAt) : null;
	if (expires && expires < new Date()) return { valid: false, error: 'expired' };

	return {
		valid: true,
		email: staff.userEmail,
		name: staff.userName,
		role: staff.role,
		restaurantName: staff.restaurantName,
		token: params.token,
	};
};

export const actions: Actions = {
	default: async ({ request, params, locals }) => {
		if (!locals.db) return { success: false, error: 'No database' };

		const fd = await request.formData();
		const name = (fd.get('name') as string)?.trim();
		const password = fd.get('password') as string;

		if (!name || !password) return { success: false, error: 'Name and password are required' };
		if (password.length < 8) return { success: false, error: 'Password must be at least 8 characters' };

		const { schema } = await import('$db');
		const { eq } = await import('drizzle-orm');

		const [staff] = await locals.db.select({
			id: schema.restaurantStaff.id,
			userId: schema.restaurantStaff.userId,
			active: schema.restaurantStaff.active,
			inviteExpiresAt: schema.restaurantStaff.inviteExpiresAt,
		})
			.from(schema.restaurantStaff)
			.where(eq(schema.restaurantStaff.inviteToken, params.token))
			.limit(1);

		if (!staff) return { success: false, error: 'Invalid invite link' };
		if (staff.active) return { success: false, error: 'Invite already accepted' };

		const expires = staff.inviteExpiresAt ? new Date(staff.inviteExpiresAt) : null;
		if (expires && expires < new Date()) return { success: false, error: 'Invite has expired' };

		await locals.db.update(schema.users)
			.set({ name, updatedAt: new Date().toISOString() })
			.where(eq(schema.users.id, staff.userId));

		const hasAccount = await locals.db.select({ id: schema.accounts.id })
			.from(schema.accounts)
			.where(eq(schema.accounts.userId, staff.userId))
			.limit(1);

		if (hasAccount.length === 0) {
			const { hashPassword: betterAuthHash } = await import('better-auth/crypto');
			const hashedPassword = await betterAuthHash(password);
			await locals.db.insert(schema.accounts).values({
				id: crypto.randomUUID(),
				userId: staff.userId,
				accountId: staff.userId,
				providerId: 'credential',
				password: hashedPassword,
			});
		}

		await locals.db.update(schema.restaurantStaff)
			.set({
				active: true,
				inviteToken: null,
				inviteExpiresAt: null,
				updatedAt: new Date().toISOString(),
			})
			.where(eq(schema.restaurantStaff.id, staff.id));

		return redirect(303, '/login?invited=true');
	}
};

