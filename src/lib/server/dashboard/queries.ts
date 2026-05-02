import { eq, and, gte, lte, desc, asc, like, or, sql, count, inArray } from 'drizzle-orm';
import type { Database } from '$db';
import { schema } from '$db';

export async function getRestaurantForUser(db: Database, userId: string) {
	const staff = await db.select({
		restaurantId: schema.restaurantStaff.restaurantId,
		role: schema.restaurantStaff.role,
	}).from(schema.restaurantStaff)
		.where(and(eq(schema.restaurantStaff.userId, userId), eq(schema.restaurantStaff.active, true)))
		.limit(1);

	if (staff.length === 0) {
		return null;
	}

	const restaurant = await db.select().from(schema.restaurants)
		.where(eq(schema.restaurants.id, staff[0].restaurantId))
		.limit(1);

	return restaurant[0] ?? null;
}

export async function getReservationsForDate(db: Database, restaurantId: string, date: string) {
	return db.select({
		id: schema.reservations.id,
		confirmationId: schema.reservations.confirmationId,
		state: schema.reservations.state,
		partySize: schema.reservations.partySize,
		scheduledTime: schema.reservations.scheduledTime,
		tableNumber: schema.reservations.tableNumber,
		origin: schema.reservations.origin,
		server: schema.reservations.server,
		guestRequest: schema.reservations.guestRequest,
		venueNotes: schema.reservations.venueNotes,
		visitTags: schema.reservations.visitTags,
		guestId: schema.reservations.guestId,
		diningAreaId: schema.reservations.diningAreaId,
		experienceDetails: schema.reservations.experienceDetails,
		posData: schema.reservations.posData,
		seatedTime: schema.reservations.seatedTime,
		doneTime: schema.reservations.doneTime,
		arrivedTime: schema.reservations.arrivedTime,
		createdAt: schema.reservations.createdAt,
		guestFirstName: schema.guests.firstName,
		guestLastName: schema.guests.lastName,
		guestEmail: schema.guests.email,
		guestPhone: schema.guests.phone,
		areaName: schema.diningAreas.name,
	}).from(schema.reservations)
		.leftJoin(schema.guests, eq(schema.reservations.guestId, schema.guests.id))
		.leftJoin(schema.diningAreas, eq(schema.reservations.diningAreaId, schema.diningAreas.id))
		.where(and(
			eq(schema.reservations.restaurantId, restaurantId),
			gte(schema.reservations.scheduledTime, `${date}T00:00:00`),
			lte(schema.reservations.scheduledTime, `${date}T23:59:59`)
		))
		.orderBy(asc(schema.reservations.scheduledTime));
}

export type DashboardReservation = Awaited<ReturnType<typeof getReservationsForDate>>[number];

export async function getGuests(db: Database, restaurantId: string) {
	const guestRows = await db.select().from(schema.guests)
		.where(and(
			eq(schema.guests.restaurantId, restaurantId),
			eq(schema.guests.archived, false)
		))
		.orderBy(desc(schema.guests.updatedAt))
		.limit(200);

	const guestIds = guestRows.map(g => g.id);
	let tagAssignments: Array<{ guestId: string; tagId: string }> = [];
	if (guestIds.length > 0) {
		tagAssignments = await db.select({
			guestId: schema.guestTagAssignments.guestId,
			tagId: schema.guestTagAssignments.tagId,
		}).from(schema.guestTagAssignments);
	}

	const tagMap = new Map<string, string[]>();
	for (const ta of tagAssignments) {
		const arr = tagMap.get(ta.guestId) ?? [];
		arr.push(ta.tagId);
		tagMap.set(ta.guestId, arr);
	}

	return guestRows.map(g => ({
		...g,
		assignedTags: tagMap.get(g.id) ?? [],
	}));
}

export async function getTables(db: Database, restaurantId: string) {
	return db.select({
		id: schema.tables.id,
		tableNumber: schema.tables.tableNumber,
		minCovers: schema.tables.minCovers,
		maxCovers: schema.tables.maxCovers,
		status: schema.tables.status,
		positionX: schema.tables.positionX,
		positionY: schema.tables.positionY,
		shape: schema.tables.shape,
		active: schema.tables.active,
		diningAreaId: schema.tables.diningAreaId,
		areaName: schema.diningAreas.name,
		areaEnvironment: schema.diningAreas.environment,
	}).from(schema.tables)
		.leftJoin(schema.diningAreas, eq(schema.tables.diningAreaId, schema.diningAreas.id))
		.where(eq(schema.tables.restaurantId, restaurantId))
		.orderBy(asc(schema.tables.tableNumber));
}

export async function getDiningAreas(db: Database, restaurantId: string) {
	return db.select().from(schema.diningAreas)
		.where(eq(schema.diningAreas.restaurantId, restaurantId))
		.orderBy(asc(schema.diningAreas.name));
}

export async function getShifts(db: Database, restaurantId: string) {
	return db.select().from(schema.shifts)
		.where(and(
			eq(schema.shifts.restaurantId, restaurantId),
			eq(schema.shifts.active, true)
		))
		.orderBy(asc(schema.shifts.dayOfWeek), asc(schema.shifts.startTime));
}

export async function getExperiences(db: Database, restaurantId: string) {
	const exps = await db.select().from(schema.experiences)
		.where(eq(schema.experiences.restaurantId, restaurantId))
		.orderBy(desc(schema.experiences.active), asc(schema.experiences.name));

	const expIds = exps.map(e => e.id);
	let prices: Array<{ experienceId: string; price: number; title: string }> = [];
	if (expIds.length > 0) {
		prices = await db.select({
			experienceId: schema.experiencePrices.experienceId,
			price: schema.experiencePrices.price,
			title: schema.experiencePrices.title,
		}).from(schema.experiencePrices);
	}

	const priceMap = new Map<string, number[]>();
	for (const p of prices) {
		const arr = priceMap.get(p.experienceId) ?? [];
		arr.push(p.price);
		priceMap.set(p.experienceId, arr);
	}

	return exps.map(e => {
		const p = priceMap.get(e.id) ?? [e.price ?? 0];
		return {
			...e,
			priceFrom: Math.min(...p),
			priceTo: Math.max(...p),
		};
	});
}

export async function getReviews(db: Database, restaurantId: string) {
	const reviewRows = await db.select().from(schema.reviews)
		.where(eq(schema.reviews.restaurantId, restaurantId))
		.orderBy(desc(schema.reviews.submissionDateTimeUtc))
		.limit(50);

	const reviewIds = reviewRows.map(r => r.id);
	let replies: Array<typeof schema.reviewReplies.$inferSelect> = [];
	if (reviewIds.length > 0) {
		replies = await db.select().from(schema.reviewReplies)
			.where(inArray(schema.reviewReplies.reviewId, reviewIds));
	}

	const replyMap = new Map<string, typeof schema.reviewReplies.$inferSelect>();
	for (const r of replies) {
		replyMap.set(r.reviewId, r);
	}

	return reviewRows.map(r => ({
		...r,
		reply: replyMap.get(r.id) ?? null,
	}));
}

export async function getReviewCount(db: Database, restaurantId: string) {
	const [result] = await db.select({ value: count() }).from(schema.reviews)
		.where(eq(schema.reviews.restaurantId, restaurantId));
	return result?.value ?? 0;
}

export async function getRestaurantSettings(db: Database, restaurantId: string) {
	const [restaurant] = await db.select().from(schema.restaurants)
		.where(eq(schema.restaurants.id, restaurantId)).limit(1);

	const bookingPoliciesRows = await db.select().from(schema.bookingPolicies)
		.where(eq(schema.bookingPolicies.restaurantId, restaurantId));

	const cancellationPoliciesRows = await db.select().from(schema.cancellationPolicies)
		.where(eq(schema.cancellationPolicies.restaurantId, restaurantId));

	const staffRows = await db.select({
		id: schema.restaurantStaff.id,
		userId: schema.restaurantStaff.userId,
		role: schema.restaurantStaff.role,
		active: schema.restaurantStaff.active,
		userName: schema.users.name,
		userEmail: schema.users.email,
	}).from(schema.restaurantStaff)
		.leftJoin(schema.users, eq(schema.restaurantStaff.userId, schema.users.id))
		.where(eq(schema.restaurantStaff.restaurantId, restaurantId));

	const integrations = await db.select().from(schema.partnerIntegrations)
		.where(eq(schema.partnerIntegrations.restaurantId, restaurantId));

	return {
		restaurant,
		bookingPolicies: bookingPoliciesRows,
		cancellationPolicies: cancellationPoliciesRows,
		staff: staffRows,
		integrations,
	};
}

export async function updateReservationState(
	db: Database,
	reservationId: string,
	newState: 'Confirmed' | 'Seated' | 'Completed' | 'Cancelled' | 'NoShow'
) {
	const now = new Date().toISOString();
	const updates: Record<string, unknown> = {
		state: newState,
		updatedAt: now,
	};

	if (newState === 'Seated') {
		updates.seatedTime = now;
	} else if (newState === 'Completed') {
		updates.doneTime = now;
	} else if (newState === 'Cancelled') {
		updates.cancellationDate = now;
	}

	await db.update(schema.reservations)
		.set(updates)
		.where(eq(schema.reservations.id, reservationId));
}

export async function createReservation(
	db: Database,
	restaurantId: string,
	rid: number,
	data: {
		guestId?: string;
		partySize: number;
		scheduledTime: string;
		server?: string;
		guestRequest?: string;
		diningAreaId?: number;
		visitTags?: string[];
		origin?: string;
		tableNumber?: string[];
	}
) {
	const [res] = await db.insert(schema.reservations).values({
		restaurantId,
		rid,
		guestId: data.guestId ?? null,
		partySize: data.partySize,
		scheduledTime: data.scheduledTime,
		state: 'Confirmed',
		server: data.server,
		guestRequest: data.guestRequest,
		diningAreaId: data.diningAreaId,
		visitTags: data.visitTags,
		tableNumber: data.tableNumber ?? null,
		origin: (data.origin as 'Web' | 'Phone/In-house') ?? 'Phone/In-house',
	}).returning();

	return res;
}

export async function createGuest(
	db: Database,
	restaurantId: string,
	rid: number,
	data: {
		firstName: string;
		lastName: string;
		email?: string;
		phone?: string;
		notes?: string;
		tags?: string[];
	}
) {
	const [guest] = await db.insert(schema.guests).values({
		restaurantId,
		rid,
		firstName: data.firstName,
		lastName: data.lastName,
		email: data.email,
		phone: data.phone,
		notes: data.notes,
		tags: data.tags,
	}).returning();

	return guest;
}

export async function createReviewReply(
	db: Database,
	reviewId: string,
	message: string,
	authorName: string
) {
	const [reply] = await db.insert(schema.reviewReplies).values({
		reviewId,
		message,
		name: authorName,
		isPublic: true,
	}).returning();

	return reply;
}

export async function updateRestaurantProfile(
	db: Database,
	restaurantId: string,
	data: Partial<typeof schema.restaurants.$inferInsert>
) {
	await db.update(schema.restaurants)
		.set({ ...data, updatedAt: new Date().toISOString() })
		.where(eq(schema.restaurants.id, restaurantId));
}

export async function getMaxAreaId(db: Database, restaurantId: string): Promise<number> {
	const result = await db.select({ maxId: sql<number>`coalesce(max(${schema.diningAreas.areaId}), 0)` })
		.from(schema.diningAreas)
		.where(eq(schema.diningAreas.restaurantId, restaurantId));
	return result[0]?.maxId ?? 0;
}

export async function getReservationVisitHistory(db: Database, guestId: string) {
	return db.select({
		id: schema.reservations.id,
		scheduledTime: schema.reservations.scheduledTime,
		partySize: schema.reservations.partySize,
		state: schema.reservations.state,
		server: schema.reservations.server,
		posData: schema.reservations.posData,
	}).from(schema.reservations)
		.where(eq(schema.reservations.guestId, guestId))
		.orderBy(desc(schema.reservations.scheduledTime))
		.limit(20);
}

// ─── Server Sections ────────────────────────────────────────────────────────

export async function getSectionsForDate(db: Database, restaurantId: string, date: string) {
	const sections = await db.select({
		id: schema.serverSections.id,
		name: schema.serverSections.name,
		staffId: schema.serverSections.staffId,
		shiftId: schema.serverSections.shiftId,
		date: schema.serverSections.date,
		color: schema.serverSections.color,
		active: schema.serverSections.active,
		staffName: schema.users.name,
	}).from(schema.serverSections)
		.leftJoin(schema.restaurantStaff, eq(schema.serverSections.staffId, schema.restaurantStaff.id))
		.leftJoin(schema.users, eq(schema.restaurantStaff.userId, schema.users.id))
		.where(and(
			eq(schema.serverSections.restaurantId, restaurantId),
			eq(schema.serverSections.date, date),
			eq(schema.serverSections.active, true)
		));

	const sectionIds = sections.map(s => s.id);
	let sectionTableRows: Array<{ sectionId: string; tableId: string }> = [];
	if (sectionIds.length > 0) {
		sectionTableRows = await db.select({
			sectionId: schema.serverSectionTables.sectionId,
			tableId: schema.serverSectionTables.tableId,
		}).from(schema.serverSectionTables)
			.where(inArray(schema.serverSectionTables.sectionId, sectionIds));
	}

	const tableMap = new Map<string, string[]>();
	for (const st of sectionTableRows) {
		const arr = tableMap.get(st.sectionId) ?? [];
		arr.push(st.tableId);
		tableMap.set(st.sectionId, arr);
	}

	return sections.map(s => ({
		...s,
		tableIds: tableMap.get(s.id) ?? [],
	}));
}

export async function getStaffServers(db: Database, restaurantId: string) {
	return db.select({
		staffId: schema.restaurantStaff.id,
		name: schema.users.name,
		active: schema.restaurantStaff.active,
	}).from(schema.restaurantStaff)
		.leftJoin(schema.users, eq(schema.restaurantStaff.userId, schema.users.id))
		.where(and(
			eq(schema.restaurantStaff.restaurantId, restaurantId),
			eq(schema.restaurantStaff.role, 'server'),
			eq(schema.restaurantStaff.active, true)
		));
}

export async function getServerForTable(db: Database, tableId: string, date: string): Promise<string | null> {
	const result = await db.select({
		staffName: schema.users.name,
	}).from(schema.serverSectionTables)
		.innerJoin(schema.serverSections, eq(schema.serverSectionTables.sectionId, schema.serverSections.id))
		.innerJoin(schema.restaurantStaff, eq(schema.serverSections.staffId, schema.restaurantStaff.id))
		.innerJoin(schema.users, eq(schema.restaurantStaff.userId, schema.users.id))
		.where(and(
			eq(schema.serverSectionTables.tableId, tableId),
			eq(schema.serverSections.date, date),
			eq(schema.serverSections.active, true)
		))
		.limit(1);

	return result[0]?.staffName ?? null;
}

// ─── Floor Plan Layouts ─────────────────────────────────────────────────────

export async function getFloorPlanLayouts(db: Database, restaurantId: string) {
	return db.select({
		id: schema.floorPlanLayouts.id,
		name: schema.floorPlanLayouts.name,
		isDefault: schema.floorPlanLayouts.isDefault,
		createdAt: schema.floorPlanLayouts.createdAt,
		updatedAt: schema.floorPlanLayouts.updatedAt,
	}).from(schema.floorPlanLayouts)
		.where(eq(schema.floorPlanLayouts.restaurantId, restaurantId))
		.orderBy(desc(schema.floorPlanLayouts.createdAt));
}

export async function getFloorPlanLayout(db: Database, layoutId: string) {
	const rows = await db.select().from(schema.floorPlanLayouts)
		.where(eq(schema.floorPlanLayouts.id, layoutId))
		.limit(1);
	return rows[0] ?? null;
}
