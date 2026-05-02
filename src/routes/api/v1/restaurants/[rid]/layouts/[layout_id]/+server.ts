import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { restaurants, floorPlanLayouts } from '$db/schema';
import { apiError, apiSuccess, requireAuthorizedRid, parseJsonBody } from '$api/helpers';
import type { Database } from '$db';

type LayoutCtx = { db: Database; restaurant: typeof restaurants.$inferSelect; layout: typeof floorPlanLayouts.$inferSelect };

async function resolveLayout(event: Parameters<RequestHandler>[0]): Promise<Response | LayoutCtx> {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const db = event.locals.db;
	if (!db) return apiError('No database', 500);

	const rest = await db.select().from(restaurants)
		.where(and(eq(restaurants.rid, ridResult), eq(restaurants.active, true)))
		.limit(1);
	if (rest.length === 0) return apiError('Restaurant not found', 404);

	const layout = await db.select().from(floorPlanLayouts)
		.where(and(eq(floorPlanLayouts.id, event.params.layout_id), eq(floorPlanLayouts.restaurantId, rest[0].id)))
		.limit(1);
	if (layout.length === 0) return apiError('Layout not found', 404);

	return { db, restaurant: rest[0], layout: layout[0] };
}

export const GET: RequestHandler = async (event) => {
	const ctx = await resolveLayout(event);
	if (ctx instanceof Response) return ctx;

	return apiSuccess({
		id: ctx.layout.id,
		name: ctx.layout.name,
		layout_data: ctx.layout.layoutData,
		is_default: ctx.layout.isDefault,
		created_at: ctx.layout.createdAt,
		updated_at: ctx.layout.updatedAt,
	});
};

interface PatchBody {
	name?: string;
	layout_data?: Record<string, unknown>;
	is_default?: boolean;
}

export const PATCH: RequestHandler = async (event) => {
	const ctx = await resolveLayout(event);
	if (ctx instanceof Response) return ctx;
	const { db, restaurant, layout } = ctx;

	const parsed = await parseJsonBody<PatchBody>(event);
	if ('error' in parsed) return parsed.error;
	const body = parsed.data;

	const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
	if (body.name !== undefined) updates.name = body.name;
	if (body.layout_data !== undefined) updates.layoutData = body.layout_data;

	if (body.is_default) {
		await db.update(floorPlanLayouts)
			.set({ isDefault: false })
			.where(eq(floorPlanLayouts.restaurantId, restaurant.id));
		updates.isDefault = true;
	} else if (body.is_default === false) {
		updates.isDefault = false;
	}

	await db.update(floorPlanLayouts).set(updates).where(eq(floorPlanLayouts.id, layout.id));

	return apiSuccess({ updated: true });
};

export const DELETE: RequestHandler = async (event) => {
	const ctx = await resolveLayout(event);
	if (ctx instanceof Response) return ctx;
	const { db, restaurant, layout } = ctx;

	if (restaurant.activeLayoutId === layout.id) {
		await db.update(restaurants)
			.set({ activeLayoutId: null })
			.where(eq(restaurants.id, restaurant.id));
	}

	await db.delete(floorPlanLayouts).where(eq(floorPlanLayouts.id, layout.id));

	return apiSuccess({ deleted: true });
};
