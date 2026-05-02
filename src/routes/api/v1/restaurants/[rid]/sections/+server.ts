import type { RequestHandler } from './$types';
import { eq, and, inArray } from 'drizzle-orm';
import { restaurants, serverSections, serverSectionTables, restaurantStaff, users, tables } from '$db/schema';
import { apiError, apiSuccess, apiValidationError, requireAuthorizedRid, parseJsonBody, validate } from '$api/helpers';

export const GET: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;
	const db = event.locals.db;

	const rest = await db.select().from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);
	if (rest.length === 0) return apiError('Restaurant not found', 404);

	const dateFilter = event.url.searchParams.get('date');
	const conditions = [
		eq(serverSections.restaurantId, rest[0].id),
		eq(serverSections.active, true),
	];
	if (dateFilter) conditions.push(eq(serverSections.date, dateFilter));

	const sections = await db.select({
		id: serverSections.id,
		name: serverSections.name,
		staff_id: serverSections.staffId,
		staff_name: users.name,
		shift_id: serverSections.shiftId,
		date: serverSections.date,
		color: serverSections.color,
		active: serverSections.active,
		created_at: serverSections.createdAt,
	}).from(serverSections)
		.leftJoin(restaurantStaff, eq(serverSections.staffId, restaurantStaff.id))
		.leftJoin(users, eq(restaurantStaff.userId, users.id))
		.where(and(...conditions));

	const sectionIds = sections.map(s => s.id);
	let tableRows: Array<{ sectionId: string; tableId: string }> = [];
	if (sectionIds.length > 0) {
		tableRows = await db.select({
			sectionId: serverSectionTables.sectionId,
			tableId: serverSectionTables.tableId,
		}).from(serverSectionTables)
			.where(inArray(serverSectionTables.sectionId, sectionIds));
	}

	const tableMap = new Map<string, string[]>();
	for (const r of tableRows) {
		const arr = tableMap.get(r.sectionId) ?? [];
		arr.push(r.tableId);
		tableMap.set(r.sectionId, arr);
	}

	return apiSuccess({
		sections: sections.map(s => ({
			...s,
			table_ids: tableMap.get(s.id) ?? [],
		})),
	});
};

interface CreateBody {
	name: string;
	staff_id: string;
	color: string;
	table_ids: string[];
	date: string;
	shift_id?: string;
}

export const POST: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;
	const db = event.locals.db;

	const rest = await db.select().from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);
	if (rest.length === 0) return apiError('Restaurant not found', 404);

	const parsed = await parseJsonBody<CreateBody>(event);
	if ('error' in parsed) return parsed.error;
	const body = parsed.data;

	const errors = validate([
		{ field: 'name', value: body.name, required: true, type: 'string' },
		{ field: 'staff_id', value: body.staff_id, required: true, type: 'string' },
		{ field: 'color', value: body.color, required: true, type: 'string' },
		{ field: 'date', value: body.date, required: true, type: 'string' },
		{ field: 'table_ids', value: body.table_ids, required: true, type: 'object' },
	]);
	if (errors.length > 0) return apiValidationError(errors);

	const staffCheck = await db.select({ id: restaurantStaff.id })
		.from(restaurantStaff)
		.where(and(eq(restaurantStaff.id, body.staff_id), eq(restaurantStaff.restaurantId, rest[0].id)))
		.limit(1);
	if (staffCheck.length === 0) return apiError('Staff member not found', 404);

	const sectionId = crypto.randomUUID();
	await db.insert(serverSections).values({
		id: sectionId,
		restaurantId: rest[0].id,
		staffId: body.staff_id,
		shiftId: body.shift_id ?? null,
		date: body.date,
		name: body.name,
		color: body.color,
		active: true,
	});

	if (body.table_ids.length > 0) {
		await db.insert(serverSectionTables).values(
			body.table_ids.map(tableId => ({
				sectionId,
				tableId,
			}))
		);
	}

	return apiSuccess({
		id: sectionId,
		name: body.name,
		staff_id: body.staff_id,
		color: body.color,
		date: body.date,
		shift_id: body.shift_id ?? null,
		table_ids: body.table_ids,
	}, 201);
};
