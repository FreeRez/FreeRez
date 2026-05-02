import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.db) {
		return { restaurant: null, bookingPolicies: [], cancellationPolicies: [], staff: [], integrations: [], gmbConfigured: false };
	}

	const { getRestaurantForUser, getRestaurantSettings } = await import('$lib/server/dashboard/queries');

	const restaurant = await getRestaurantForUser(locals.db, locals.user?.id ?? '');
	if (!restaurant) {
		return { restaurant: null, bookingPolicies: [], cancellationPolicies: [], staff: [], integrations: [], gmbConfigured: false };
	}

	const settings = await getRestaurantSettings(locals.db, restaurant.id);

	const env = (platform?.env ?? {}) as Record<string, string | undefined>;
	const { getProviderConfig, resolveCredentials } = await import('$lib/server/integrations/registry');
	const gmbConfig = getProviderConfig('google-my-business');
	const gmbConfigured = gmbConfig ? !!resolveCredentials(gmbConfig, env) : false;

	const { getFloorPlanLayouts, getFloorPlanLayout } = await import('$lib/server/dashboard/queries');
	const layouts = await getFloorPlanLayouts(locals.db, restaurant.id);

	let savedLayout = restaurant.floorPlanLayout as { floors?: unknown[]; tables?: unknown[] } | null;
	if (restaurant.activeLayoutId) {
		const activeLayout = await getFloorPlanLayout(locals.db, restaurant.activeLayoutId);
		if (activeLayout?.layoutData) {
			savedLayout = activeLayout.layoutData as { floors?: unknown[]; tables?: unknown[] };
		}
	}

	return {
		restaurant: settings.restaurant,
		bookingPolicies: settings.bookingPolicies,
		cancellationPolicies: settings.cancellationPolicies,
		staff: settings.staff,
		integrations: settings.integrations,
		gmbConfigured,
		savedLayout,
		layouts,
		activeLayoutId: restaurant.activeLayoutId ?? null,
	};
};

export const actions: Actions = {
	updateProfile: async ({ request, locals }) => {
		if (!locals.db) return { success: false, error: 'No database' };
		const formData = await request.formData();
		const { getRestaurantForUser, updateRestaurantProfile } = await import('$lib/server/dashboard/queries');
		const restaurant = await getRestaurantForUser(locals.db, locals.user?.id ?? '');
		if (!restaurant) return { success: false, error: 'No restaurant' };
		await updateRestaurantProfile(locals.db, restaurant.id, {
			name: formData.get('name') as string || undefined,
			description: formData.get('description') as string || undefined,
			primaryCuisine: formData.get('cuisine') as string || undefined,
			phone: formData.get('phone') as string || undefined,
			website: formData.get('website') as string || undefined,
			diningStyle: formData.get('diningStyle') as string || undefined,
			dressCode: formData.get('dressCode') as string || undefined,
			timezone: formData.get('timezone') as string || undefined,
			priceBandId: formData.get('priceBandId') ? parseInt(formData.get('priceBandId') as string, 10) : undefined,
		});
		return { success: true };
	},

	createPolicy: async ({ request, locals }) => {
		if (!locals.db) return { success: false, error: 'No database' };
		const fd = await request.formData();
		const { getRestaurantForUser } = await import('$lib/server/dashboard/queries');
		const restaurant = await getRestaurantForUser(locals.db, locals.user?.id ?? '');
		if (!restaurant) return { success: false, error: 'No restaurant' };

		const { schema } = await import('$db');
		await locals.db.insert(schema.bookingPolicies).values({
			restaurantId: restaurant.id,
			policyType: (fd.get('type') as string as 'General' | 'Cancellation' | 'Group' | 'Custom') || 'General',
			message: fd.get('message') as string || '',
			active: true,
		});
		return { success: true };
	},

	deletePolicy: async ({ request, locals }) => {
		if (!locals.db) return { success: false, error: 'No database' };
		const fd = await request.formData();
		const policyId = fd.get('policyId') as string;
		const { schema } = await import('$db');
		const { eq } = await import('drizzle-orm');
		await locals.db.delete(schema.bookingPolicies).where(eq(schema.bookingPolicies.id, policyId));
		return { success: true };
	},

	updatePolicy: async ({ request, locals }) => {
		if (!locals.db) return { success: false, error: 'No database' };
		const fd = await request.formData();
		const policyId = fd.get('policyId') as string;
		const message = fd.get('message') as string;
		const { schema } = await import('$db');
		const { eq } = await import('drizzle-orm');
		await locals.db.update(schema.bookingPolicies)
			.set({ message })
			.where(eq(schema.bookingPolicies.id, policyId));
		return { success: true };
	},

	removeMember: async ({ request, locals }) => {
		if (!locals.db) return { success: false, error: 'No database' };
		const fd = await request.formData();
		const staffId = fd.get('staffId') as string;
		if (!staffId) return { success: false, error: 'Staff ID required' };

		const { getRestaurantForUser } = await import('$lib/server/dashboard/queries');
		const restaurant = await getRestaurantForUser(locals.db, locals.user?.id ?? '');
		if (!restaurant) return { success: false, error: 'No restaurant' };

		const { schema } = await import('$db');
		const { eq, and } = await import('drizzle-orm');

		const [staff] = await locals.db.select().from(schema.restaurantStaff)
			.where(and(
				eq(schema.restaurantStaff.id, staffId),
				eq(schema.restaurantStaff.restaurantId, restaurant.id)
			)).limit(1);

		if (!staff) return { success: false, error: 'Staff member not found' };
		if (staff.role === 'owner') return { success: false, error: 'Cannot remove the owner' };

		await locals.db.delete(schema.restaurantStaff)
			.where(and(
				eq(schema.restaurantStaff.id, staffId),
				eq(schema.restaurantStaff.restaurantId, restaurant.id)
			));

		return { success: true };
	},

	updateStaffRole: async ({ request, locals }) => {
		if (!locals.db) return { success: false, error: 'No database' };
		const fd = await request.formData();
		const staffId = fd.get('staffId') as string;
		const newRole = fd.get('role') as string;
		if (!staffId || !newRole) return { success: false, error: 'Staff ID and role required' };

		const validRoles = ['owner', 'manager', 'host', 'server'];
		if (!validRoles.includes(newRole)) return { success: false, error: 'Invalid role' };

		const { getRestaurantForUser } = await import('$lib/server/dashboard/queries');
		const restaurant = await getRestaurantForUser(locals.db, locals.user?.id ?? '');
		if (!restaurant) return { success: false, error: 'No restaurant' };

		const { schema } = await import('$db');
		const { eq, and } = await import('drizzle-orm');

		await locals.db.update(schema.restaurantStaff)
			.set({ role: newRole as 'owner' | 'manager' | 'host' | 'server', updatedAt: new Date().toISOString() })
			.where(and(
				eq(schema.restaurantStaff.id, staffId),
				eq(schema.restaurantStaff.restaurantId, restaurant.id)
			));

		return { success: true };
	},

	updateStaffMember: async ({ request, locals }) => {
		if (!locals.db) return { success: false, error: 'No database' };
		const fd = await request.formData();
		const staffId = fd.get('staffId') as string;
		const name = (fd.get('name') as string)?.trim();
		const email = (fd.get('email') as string)?.trim().toLowerCase();

		if (!staffId) return { success: false, error: 'Staff ID required' };

		const { getRestaurantForUser } = await import('$lib/server/dashboard/queries');
		const restaurant = await getRestaurantForUser(locals.db, locals.user?.id ?? '');
		if (!restaurant) return { success: false, error: 'No restaurant' };

		const { schema } = await import('$db');
		const { eq, and } = await import('drizzle-orm');

		const [staff] = await locals.db.select()
			.from(schema.restaurantStaff)
			.where(and(
				eq(schema.restaurantStaff.id, staffId),
				eq(schema.restaurantStaff.restaurantId, restaurant.id)
			)).limit(1);

		if (!staff) return { success: false, error: 'Staff member not found' };

		const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
		if (name) updates.name = name;
		if (email) updates.email = email;

		if (Object.keys(updates).length > 1) {
			await locals.db.update(schema.users)
				.set(updates)
				.where(eq(schema.users.id, staff.userId));
		}

		return { success: true };
	},

	createPrivateRoom: async ({ request, locals }) => {
		if (!locals.db) return { success: false, error: 'No database' };
		const fd = await request.formData();
		const { getRestaurantForUser, getMaxAreaId } = await import('$lib/server/dashboard/queries');
		const restaurant = await getRestaurantForUser(locals.db, locals.user?.id ?? '');
		if (!restaurant) return { success: false, error: 'No restaurant' };

		const { schema } = await import('$db');
		const nextAreaId = await getMaxAreaId(locals.db, restaurant.id) + 1;

		await locals.db.insert(schema.diningAreas).values({
			restaurantId: restaurant.id,
			areaId: nextAreaId,
			name: fd.get('name') as string || 'Private Room',
			description: fd.get('description') as string || null,
			environment: 'Indoor',
			attributes: ['private dining'],
			active: true,
		});
		return { success: true };
	},

	syncGmbReviews: async ({ request, locals, platform }) => {
		if (!locals.db) return { success: false, error: 'No database' };
		const fd = await request.formData();
		const restaurantId = fd.get('restaurantId') as string;
		if (!restaurantId) return { success: false, error: 'No restaurant' };

		const { eq, and } = await import('drizzle-orm');
		const { schema } = await import('$db');
		const { getProviderConfig, resolveCredentialsFromDb } = await import('$lib/server/integrations/registry');
		const { ensureValidToken } = await import('$lib/server/integrations/token-manager');
		const { syncReviews } = await import('$lib/server/integrations/google-my-business/review-sync');

		const integration = await locals.db.select().from(schema.partnerIntegrations)
			.where(and(
				eq(schema.partnerIntegrations.restaurantId, restaurantId),
				eq(schema.partnerIntegrations.partnerId, 'google-my-business'),
				eq(schema.partnerIntegrations.status, 'active')
			)).limit(1);

		if (integration.length === 0) return { success: false, error: 'Not connected' };

		const config = getProviderConfig('google-my-business')!;
		const env = (platform?.env ?? {}) as Record<string, string | undefined>;
		const integMetadata = integration[0].metadata as Record<string, unknown> | null;
		const credentials = await resolveCredentialsFromDb(config, locals.cpDb, env, integMetadata);
		if (!credentials) return { success: false, error: 'Not configured' };

		const restaurant = await locals.db.select().from(schema.restaurants)
			.where(eq(schema.restaurants.id, restaurantId)).limit(1);
		if (restaurant.length === 0) return { success: false, error: 'No restaurant' };

		try {
			const accessToken = await ensureValidToken(locals.db, integration[0], config, credentials);
			const result = await syncReviews(locals.db, accessToken, integration[0].partnerIdentifier!, restaurantId, restaurant[0].rid);
			return { success: true, result };
		} catch (err) {
			return { success: false, error: err instanceof Error ? err.message : 'Sync failed' };
		}
	},

	saveIntegrationCredentials: async ({ request, locals }) => {
		if (!locals.db) return { success: false, error: 'No database' };
		const fd = await request.formData();
		const { getRestaurantForUser } = await import('$lib/server/dashboard/queries');
		const restaurant = await getRestaurantForUser(locals.db, locals.user?.id ?? '');
		if (!restaurant) return { success: false, error: 'No restaurant' };

		const providerId = fd.get('providerId') as string;
		const clientId = (fd.get('clientId') as string)?.trim();
		const clientSecret = (fd.get('clientSecret') as string)?.trim();
		if (!providerId || !clientId || !clientSecret) {
			return { success: false, error: 'All fields are required' };
		}

		const { schema } = await import('$db');
		const { eq, and } = await import('drizzle-orm');

		const existing = await locals.db.select().from(schema.partnerIntegrations)
			.where(and(
				eq(schema.partnerIntegrations.restaurantId, restaurant.id),
				eq(schema.partnerIntegrations.partnerId, providerId)
			)).limit(1);

		const metadata = {
			...(existing[0]?.metadata as Record<string, unknown> ?? {}),
			oauthClientId: clientId,
			oauthClientSecret: clientSecret,
		};

		if (existing.length > 0) {
			await locals.db.update(schema.partnerIntegrations)
				.set({ metadata, updatedAt: new Date().toISOString() })
				.where(eq(schema.partnerIntegrations.id, existing[0].id));
		} else {
			await locals.db.insert(schema.partnerIntegrations).values({
				restaurantId: restaurant.id,
				partnerId: providerId,
				status: 'inactive',
				metadata,
			});
		}

		return { success: true };
	},

	inviteMember: async ({ request, locals, url }) => {
		if (!locals.db) return { success: false, error: 'No database' };
		const fd = await request.formData();
		const { getRestaurantForUser } = await import('$lib/server/dashboard/queries');
		const restaurant = await getRestaurantForUser(locals.db, locals.user?.id ?? '');
		if (!restaurant) return { success: false, error: 'No restaurant' };

		const { schema } = await import('$db');
		const { eq, and } = await import('drizzle-orm');
		const email = (fd.get('email') as string)?.trim().toLowerCase();
		const role = fd.get('role') as string || 'server';

		if (!email) return { success: false, error: 'Email is required' };

		const validRoles = ['owner', 'manager', 'host', 'server'];
		if (!validRoles.includes(role)) return { success: false, error: 'Invalid role' };

		const existingUser = await locals.db.select({ id: schema.users.id })
			.from(schema.users)
			.where(eq(schema.users.email, email))
			.limit(1);

		let userId: string;

		if (existingUser.length > 0) {
			userId = existingUser[0].id;
			const existingStaff = await locals.db.select({ id: schema.restaurantStaff.id })
				.from(schema.restaurantStaff)
				.where(and(
					eq(schema.restaurantStaff.restaurantId, restaurant.id),
					eq(schema.restaurantStaff.userId, userId)
				)).limit(1);

			if (existingStaff.length > 0) {
				return { success: false, error: 'This person is already a team member' };
			}
		} else {
			userId = crypto.randomUUID();
			await locals.db.insert(schema.users).values({
				id: userId,
				name: email.split('@')[0],
				email,
				role: role as typeof schema.users.$inferInsert['role'],
			});
		}

		const inviteToken = crypto.randomUUID();
		const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

		await locals.db.insert(schema.restaurantStaff).values({
			restaurantId: restaurant.id,
			userId,
			role: role as 'owner' | 'manager' | 'host' | 'server',
			active: false,
			inviteToken,
			inviteExpiresAt,
		});

		const inviteUrl = `${url.origin}/invite/${inviteToken}`;
		const inviterName = locals.user?.name ?? 'A team member';

		if (locals.notifications?.email) {
			const { staffInviteEmail } = await import('$lib/server/notifications/templates');
			const emailMsg = staffInviteEmail({
				restaurantName: restaurant.name,
				inviteeEmail: email,
				inviteeName: email.split('@')[0],
				inviterName,
				role: role.charAt(0).toUpperCase() + role.slice(1),
				inviteUrl,
			}, 'noreply@freerez.com');
			locals.notifications.email.send(emailMsg).catch(() => {});
		}

		return { success: true, inviteUrl };
	},
};
