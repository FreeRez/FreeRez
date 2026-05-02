import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { restaurants, serverSections, serverSectionTables, restaurantStaff, users } from '$db/schema';
import { apiError, apiSuccess, requireAuthorizedRid, parseJsonBody } from '$api/helpers';
import type { Database } from '$db';

type SectionCtx = { db: Database; restaurantId: string; section: typeof serverSections.$inferSelect };

async function resolveSection(event: Parameters<RequestHandler>[0]): Promise<Response | SectionCtx> {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const db = event.locals.db;
	if (!db) return apiError('No database', 500);

	const rest = await db.select().from(restaurants)
		.where(and(eq(restaurants.rid, ridResult), eq(restaurants.active, true)))
		.limit(1);
	if (rest.length === 0) return apiError('Restaurant not found', 404);

	const section = await db.select().from(serverSections)
		.where(and(eq(serverSections.id, event.params.section_id), eq(serverSections.restaurantId, rest[0].id)))
		.limit(1);
	if (section.length === 0) return apiError('Section not found', 404);

	return { db, restaurantId: rest[0].id, section: section[0] };
}

export const GET: RequestHandler = async (event) => {
	const ctx = await resolveSection(event);
	if (ctx instanceof Response) return ctx;
	const { db, section } = ctx;

	const staffRow = await db.select({ name: users.name })
		.from(restaurantStaff)
		.leftJoin(users, eq(restaurantStaff.userId, users.id))
		.where(eq(restaurantStaff.id, section.staffId))
		.limit(1);

	const tableRows = await db.select({ tableId: serverSectionTables.tableId })
		.from(serverSectionTables)
		.where(eq(serverSectionTables.sectionId, section.id));

	return apiSuccess({
		id: section.id,
		name: section.name,
		staff_id: section.staffId,
		staff_name: staffRow[0]?.name ?? null,
		shift_id: section.shiftId,
		date: section.date,
		color: section.color,
		active: section.active,
		table_ids: tableRows.map(r => r.tableId),
		created_at: section.createdAt,
		updated_at: section.updatedAt,
	});
};

interface PatchBody {
	name?: string;
	staff_id?: string;
	color?: string;
	table_ids?: string[];
	active?: boolean;
}

export const PATCH: RequestHandler = async (event) => {
	const ctx = await resolveSection(event);
	if (ctx instanceof Response) return ctx;
	const { db, section } = ctx;

	const parsed = await parseJsonBody<PatchBody>(event);
	if ('error' in parsed) return parsed.error;
	const body = parsed.data;

	const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
	if (body.name !== undefined) updates.name = body.name;
	if (body.staff_id !== undefined) updates.staffId = body.staff_id;
	if (body.color !== undefined) updates.color = body.color;
	if (body.active !== undefined) updates.active = body.active;

	if (Object.keys(updates).length > 1) {
		await db.update(serverSections).set(updates).where(eq(serverSections.id, section.id));
	}

	if (body.table_ids !== undefined) {
		await db.delete(serverSectionTables).where(eq(serverSectionTables.sectionId, section.id));
		if (body.table_ids.length > 0) {
			await db.insert(serverSectionTables).values(
				body.table_ids.map(tableId => ({ sectionId: section.id, tableId }))
			);
		}
	}

	return apiSuccess({ updated: true });
};

export const DELETE: RequestHandler = async (event) => {
	const ctx = await resolveSection(event);
	if (ctx instanceof Response) return ctx;
	const { db, section } = ctx;

	await db.delete(serverSections).where(eq(serverSections.id, section.id));
	return apiSuccess({ deleted: true });
};
