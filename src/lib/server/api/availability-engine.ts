import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { restaurants, shifts, reservations, diningAreas, tables, slotLocks, experiences } from '$db/schema';
import type { Database } from '$db';
import { getReservationDuration } from '$lib/shared/reservation-duration';

export { getReservationDuration };

export type TableRecord = typeof tables.$inferSelect;
export type DiningAreaRecord = typeof diningAreas.$inferSelect;
export type ReservationRecord = typeof reservations.$inferSelect;
export type ShiftRecord = typeof shifts.$inferSelect;
export type ExperienceRecord = typeof experiences.$inferSelect;

export type SlotAvailability = {
	time: string;
	availableTables: Array<{
		tableId: string;
		tableNumber: string;
		diningAreaId: string;
		areaId: number;
		minCovers: number;
		maxCovers: number;
		environment: string | null;
		attributes: string[];
	}>;
	totalAvailableCovers: number;
	canSeatParty: boolean;
};

export function formatSlotTime(d: Date): string {
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	const hh = String(d.getHours()).padStart(2, '0');
	const mi = String(d.getMinutes()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export async function calculateAvailability(params: {
	db: Database;
	restaurantId?: string;
	rid: number;
	startDateTime: string;
	forwardMinutes: number;
	backwardMinutes: number;
	partySize: number;
	includeExperiences: boolean;
}): Promise<{
	restaurant: typeof restaurants.$inferSelect;
	slots: SlotAvailability[];
	areas: DiningAreaRecord[];
	shifts: ShiftRecord[];
	activeExperiences: ExperienceRecord[];
} | null> {
	const { db, rid, startDateTime, forwardMinutes, backwardMinutes, partySize, includeExperiences } = params;

	const rest = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);

	if (rest.length === 0) return null;
	const restaurant = rest[0];
	const restaurantId = restaurant.id;

	const startDate = new Date(startDateTime);
	const windowStart = new Date(startDate.getTime() - backwardMinutes * 60 * 1000);
	const windowEnd = new Date(startDate.getTime() + forwardMinutes * 60 * 1000);

	const areas = await db
		.select()
		.from(diningAreas)
		.where(and(eq(diningAreas.restaurantId, restaurantId), eq(diningAreas.active, true)));

	const allTables = await db
		.select()
		.from(tables)
		.where(and(eq(tables.restaurantId, restaurantId), eq(tables.active, true)));

	// Reservations that could overlap our window.
	// A reservation at time T occupies a table for getReservationDuration(partySize) minutes.
	// So we need reservations where their start is within [windowStart - maxDuration, windowEnd].
	const maxDuration = 180;
	const lookbackStart = new Date(windowStart.getTime() - maxDuration * 60 * 1000);

	const existingReservations = await db
		.select()
		.from(reservations)
		.where(
			and(
				eq(reservations.restaurantId, restaurantId),
				gte(reservations.scheduledTime, lookbackStart.toISOString()),
				lte(reservations.scheduledTime, windowEnd.toISOString()),
				sql`${reservations.state} NOT IN ('Cancelled', 'CancelledWeb', 'NoShow', 'Completed')`
			)
		);

	// Active slot locks also block tables
	const activeLocks = await db
		.select()
		.from(slotLocks)
		.where(
			and(
				eq(slotLocks.restaurantId, restaurantId),
				gte(slotLocks.expiresAt, new Date().toISOString())
			)
		);

	const dayOfWeek = startDate.getDay();
	const activeShifts = await db
		.select()
		.from(shifts)
		.where(
			and(
				eq(shifts.restaurantId, restaurantId),
				eq(shifts.dayOfWeek, dayOfWeek),
				eq(shifts.active, true)
			)
		);

	let activeExperiences: ExperienceRecord[] = [];
	if (includeExperiences) {
		activeExperiences = await db
			.select()
			.from(experiences)
			.where(
				and(
					eq(experiences.restaurantId, restaurantId),
					eq(experiences.active, true),
					eq(experiences.bookable, true)
				)
			);
	}

	const intervalMinutes =
		activeShifts.length > 0 ? (activeShifts[0].slotIntervalMinutes ?? 15) : 15;

	// Build area lookup
	const areaById = new Map(areas.map((a) => [a.id, a]));

	const current = new Date(windowStart);
	const mins = current.getMinutes();
	const aligned = Math.ceil(mins / intervalMinutes) * intervalMinutes;
	current.setMinutes(aligned, 0, 0);

	const slots: SlotAvailability[] = [];

	while (current <= windowEnd) {
		const slotStart = current.getTime();
		const requestedDuration = getReservationDuration(partySize);
		const slotEnd = slotStart + requestedDuration * 60 * 1000;

		// Check if this slot falls within any active shift
		const timeStr = `${String(current.getHours()).padStart(2, '0')}:${String(current.getMinutes()).padStart(2, '0')}`;
		const withinShift = activeShifts.length === 0 || activeShifts.some((s) => timeStr >= s.startTime && timeStr < s.endTime);

		if (!withinShift) {
			current.setMinutes(current.getMinutes() + intervalMinutes);
			continue;
		}

		// Find tables occupied during this slot.
		// A table is occupied if an existing reservation overlaps [slotStart, slotEnd).
		const occupiedTableIds = new Set<string>();

		for (const res of existingReservations) {
			const resStart = new Date(res.scheduledTime).getTime();
			const resDuration = getReservationDuration(res.partySize);
			const resEnd = resStart + resDuration * 60 * 1000;

			// Overlap check: two intervals [a,b) and [c,d) overlap if a < d && c < b
			if (slotStart < resEnd && resStart < slotEnd) {
				// Which table(s) is this reservation using?
				const tableNumbers = (res.tableNumber as string[]) ?? [];
				for (const tn of tableNumbers) {
					const table = allTables.find((t) => t.tableNumber === tn);
					if (table) occupiedTableIds.add(table.id);
				}

				// Reservations without assigned tables still consume capacity.
				// We mark a "virtual" table as occupied based on dining area.
				if (tableNumbers.length === 0 && res.diningAreaId) {
					const fittingTable = allTables.find(
						(t) =>
							!occupiedTableIds.has(t.id) &&
							t.diningAreaId &&
							areaById.get(t.diningAreaId)?.areaId === res.diningAreaId &&
							t.maxCovers >= res.partySize
					);
					if (fittingTable) occupiedTableIds.add(fittingTable.id);
				}
			}
		}

		// Slot locks also occupy tables (even though they don't have table assignments,
		// they reduce available capacity)
		for (const lock of activeLocks) {
			const lockStart = new Date(lock.dateTime).getTime();
			const lockDuration = getReservationDuration(lock.partySize);
			const lockEnd = lockStart + lockDuration * 60 * 1000;

			if (slotStart < lockEnd && lockStart < slotEnd) {
				const fittingTable = allTables.find(
					(t) =>
						!occupiedTableIds.has(t.id) &&
						t.maxCovers >= lock.partySize &&
						(lock.diningAreaId == null ||
							(t.diningAreaId && areaById.get(t.diningAreaId)?.areaId === lock.diningAreaId))
				);
				if (fittingTable) occupiedTableIds.add(fittingTable.id);
			}
		}

		// Find available tables that can seat the requested party
		const availableTables = allTables
			.filter((t) => !occupiedTableIds.has(t.id) && t.maxCovers >= partySize && (t.minCovers ?? 1) <= partySize)
			.map((t) => {
				const area = t.diningAreaId ? areaById.get(t.diningAreaId) : null;
				return {
					tableId: t.id,
					tableNumber: t.tableNumber,
					diningAreaId: t.diningAreaId ?? '',
					areaId: area?.areaId ?? 1,
					minCovers: t.minCovers ?? 1,
					maxCovers: t.maxCovers,
					environment: area?.environment ?? null,
					attributes: (area?.attributes as string[]) ?? ['default']
				};
			});

		const totalAvailableCovers = availableTables.reduce((sum, t) => sum + t.maxCovers, 0);
		const canSeatParty = availableTables.length > 0;

		slots.push({
			time: formatSlotTime(current),
			availableTables,
			totalAvailableCovers,
			canSeatParty
		});

		current.setMinutes(current.getMinutes() + intervalMinutes);
	}

	return {
		restaurant,
		slots,
		areas,
		shifts: activeShifts,
		activeExperiences
	};
}
