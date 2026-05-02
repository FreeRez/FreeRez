import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { restaurants, floorPlanLayouts } from '$db/schema';
import { apiError, apiSuccess, apiValidationError, requireAuthorizedRid, parseJsonBody, validate } from '$api/helpers';

export const GET: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const db = event.locals.db;
	if (!db) return apiError('No database', 500);

	const rest = await db.select().from(restaurants)
		.where(and(eq(restaurants.rid, ridResult), eq(restaurants.active, true)))
		.limit(1);
	if (rest.length === 0) return apiError('Restaurant not found', 404);

	const layouts = await db.select({
		id: floorPlanLayouts.id,
		name: floorPlanLayouts.name,
		is_default: floorPlanLayouts.isDefault,
		created_at: floorPlanLayouts.createdAt,
		updated_at: floorPlanLayouts.updatedAt,
	}).from(floorPlanLayouts)
		.where(eq(floorPlanLayouts.restaurantId, rest[0].id));

	return apiSuccess({
		layouts,
		active_layout_id: rest[0].activeLayoutId ?? null,
	});
};

interface CreateBody {
	name: string;
	layout_data?: Record<string, unknown>;
	is_default?: boolean;
}

export const POST: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const db = event.locals.db;
	if (!db) return apiError('No database', 500);

	const rest = await db.select().from(restaurants)
		.where(and(eq(restaurants.rid, ridResult), eq(restaurants.active, true)))
		.limit(1);
	if (rest.length === 0) return apiError('Restaurant not found', 404);

	const parsed = await parseJsonBody<CreateBody>(event);
	if ('error' in parsed) return parsed.error;
	const body = parsed.data;

	const errors = validate([
		{ field: 'name', value: body.name, required: true, type: 'string' },
	]);
	if (errors.length > 0) return apiValidationError(errors);

	const layoutId = crypto.randomUUID();
	const now = new Date().toISOString();

	if (body.is_default) {
		await db.update(floorPlanLayouts)
			.set({ isDefault: false })
			.where(eq(floorPlanLayouts.restaurantId, rest[0].id));
	}

	await db.insert(floorPlanLayouts).values({
		id: layoutId,
		restaurantId: rest[0].id,
		name: body.name,
		layoutData: body.layout_data ?? rest[0].floorPlanLayout ?? null,
		isDefault: body.is_default ?? false,
		createdAt: now,
		updatedAt: now,
	});

	return apiSuccess({
		id: layoutId,
		name: body.name,
		is_default: body.is_default ?? false,
	}, 201);
};
