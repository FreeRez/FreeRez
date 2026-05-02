import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { restaurants, restaurantStaff, users } from '$db/schema';
import { apiError, apiSuccess, apiValidationError, requireAuthorizedRid, parseJsonBody, validate } from '$api/helpers';

export const GET: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;

	const db = event.locals.db;

	const rest = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);

	if (rest.length === 0) return apiError('Restaurant not found', 404);

	const staff = await db
		.select({
			StaffId: restaurantStaff.id,
			UserId: restaurantStaff.userId,
			Name: users.name,
			Email: users.email,
			Role: restaurantStaff.role,
			Active: restaurantStaff.active,
			CreatedAt: restaurantStaff.createdAt,
			UpdatedAt: restaurantStaff.updatedAt,
		})
		.from(restaurantStaff)
		.leftJoin(users, eq(restaurantStaff.userId, users.id))
		.where(eq(restaurantStaff.restaurantId, rest[0].id));

	return apiSuccess({ Staff: staff });
};

interface InviteBody {
	Email: string;
	Name?: string;
	Role: string;
}

export const POST: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;

	const db = event.locals.db;

	const rest = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);

	if (rest.length === 0) return apiError('Restaurant not found', 404);

	const parsed = await parseJsonBody<InviteBody>(event);
	if ('error' in parsed) return parsed.error;
	const body = parsed.data;

	const errors = validate([
		{ field: 'Email', value: body.Email, required: true, type: 'string' },
		{ field: 'Role', value: body.Role, required: true, type: 'string', enum: ['owner', 'manager', 'host', 'server'] },
	]);
	if (errors.length > 0) return apiValidationError(errors);

	const email = body.Email.trim().toLowerCase();

	const existingUser = await db.select({ id: users.id })
		.from(users)
		.where(eq(users.email, email))
		.limit(1);

	let userId: string;

	if (existingUser.length > 0) {
		userId = existingUser[0].id;
		const existingStaff = await db.select({ id: restaurantStaff.id })
			.from(restaurantStaff)
			.where(and(
				eq(restaurantStaff.restaurantId, rest[0].id),
				eq(restaurantStaff.userId, userId)
			)).limit(1);

		if (existingStaff.length > 0) {
			return apiError('This person is already a team member', 409);
		}
	} else {
		userId = crypto.randomUUID();
		await db.insert(users).values({
			id: userId,
			name: body.Name ?? email.split('@')[0],
			email,
			role: body.Role as typeof users.$inferInsert['role'],
		});
	}

	const inviteToken = crypto.randomUUID();
	const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

	const [created] = await db.insert(restaurantStaff).values({
		restaurantId: rest[0].id,
		userId,
		role: body.Role as 'owner' | 'manager' | 'host' | 'server',
		active: false,
		inviteToken,
		inviteExpiresAt,
	}).returning();

	const inviteUrl = `${event.url.origin}/invite/${inviteToken}`;

	if (event.locals.notifications?.email) {
		const { staffInviteEmail } = await import('$lib/server/notifications/templates');
		event.locals.notifications.email.send(staffInviteEmail({
			restaurantName: rest[0].name,
			inviteeEmail: email,
			inviteeName: body.Name ?? email.split('@')[0],
			inviterName: 'API',
			role: body.Role.charAt(0).toUpperCase() + body.Role.slice(1),
			inviteUrl,
		}, 'noreply@freerez.com')).catch(() => {});
	}

	return apiSuccess({
		StaffId: created.id,
		UserId: userId,
		Email: email,
		Role: body.Role,
		Active: false,
		InviteUrl: inviteUrl,
	}, 201);
};
