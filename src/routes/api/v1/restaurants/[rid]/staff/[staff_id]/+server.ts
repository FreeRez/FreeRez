import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { restaurants, restaurantStaff, users } from '$db/schema';
import { apiError, apiSuccess, apiValidationError, requireAuthorizedRid, parseJsonBody, validate } from '$api/helpers';

export const GET: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;

	const db = event.locals.db;
	const staffId = event.params.staff_id;
	if (!staffId) return apiError('Staff ID is required', 400);

	const rest = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);

	if (rest.length === 0) return apiError('Restaurant not found', 404);

	const [staff] = await db
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
		.where(and(
			eq(restaurantStaff.id, staffId),
			eq(restaurantStaff.restaurantId, rest[0].id)
		))
		.limit(1);

	if (!staff) return apiError('Staff member not found', 404);

	return apiSuccess(staff);
};

export const PUT: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;

	const db = event.locals.db;
	const staffId = event.params.staff_id;
	if (!staffId) return apiError('Staff ID is required', 400);

	const rest = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);

	if (rest.length === 0) return apiError('Restaurant not found', 404);

	const parsed = await parseJsonBody<{ Role?: string; Active?: boolean }>(event);
	if ('error' in parsed) return parsed.error;
	const body = parsed.data;

	if (body.Role) {
		const errors = validate([
			{ field: 'Role', value: body.Role, type: 'string', enum: ['owner', 'manager', 'host', 'server'] },
		]);
		if (errors.length > 0) return apiValidationError(errors);
	}

	const [existing] = await db.select()
		.from(restaurantStaff)
		.where(and(
			eq(restaurantStaff.id, staffId),
			eq(restaurantStaff.restaurantId, rest[0].id)
		)).limit(1);

	if (!existing) return apiError('Staff member not found', 404);

	const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
	if (body.Role) updates.role = body.Role;
	if (body.Active !== undefined) updates.active = body.Active;

	await db.update(restaurantStaff)
		.set(updates)
		.where(eq(restaurantStaff.id, staffId));

	return apiSuccess({ StaffId: staffId, ...updates });
};

export const DELETE: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;

	const db = event.locals.db;
	const staffId = event.params.staff_id;
	if (!staffId) return apiError('Staff ID is required', 400);

	const rest = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);

	if (rest.length === 0) return apiError('Restaurant not found', 404);

	const [existing] = await db.select()
		.from(restaurantStaff)
		.where(and(
			eq(restaurantStaff.id, staffId),
			eq(restaurantStaff.restaurantId, rest[0].id)
		)).limit(1);

	if (!existing) return apiError('Staff member not found', 404);
	if (existing.role === 'owner') return apiError('Cannot remove the restaurant owner', 403);

	await db.delete(restaurantStaff)
		.where(eq(restaurantStaff.id, staffId));

	return apiSuccess({ deleted: true });
};
