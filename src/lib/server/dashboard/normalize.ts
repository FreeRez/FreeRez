import type { DashboardReservation } from './queries';

export function normalizeReservation(r: DashboardReservation) {
	const scheduled = new Date(r.scheduledTime);
	const time = scheduled.toTimeString().slice(0, 5);
	const date = scheduled.toISOString().slice(0, 10);

	type ReservationStatus = 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no-show';
	const stateMap: Record<string, ReservationStatus> = {
		Pending: 'confirmed',
		Confirmed: 'confirmed',
		Seated: 'seated',
		Completed: 'completed',
		Cancelled: 'cancelled',
		CancelledWeb: 'cancelled',
		NoShow: 'no-show',
	};

	const confId = r.confirmationId;
	const confStr = `FR-${confId.toString(36).toUpperCase().padStart(6, '0')}`;

	const spend = r.posData
		? ((r.posData as { pos_total_spend?: number }).pos_total_spend ?? null)
		: null;

	const exp = r.experienceDetails
		? {
			name: (r.experienceDetails as { experience_title?: string }).experience_title ?? 'Experience',
			total: (r.experienceDetails as { total_amount?: number }).total_amount ?? 0,
		}
		: null;

	const tableNumbers = (Array.isArray(r.tableNumber) ? r.tableNumber : typeof r.tableNumber === 'string' ? JSON.parse(r.tableNumber) : []) as string[];

	return {
		id: r.id,
		conf: confStr,
		time,
		date,
		scheduledTime: r.scheduledTime,
		party: r.partySize,
		guest: [r.guestFirstName, r.guestLastName].filter(Boolean).join(' ') || 'Walk-in',
		phone: r.guestPhone ?? '',
		email: r.guestEmail ?? '',
		area: r.areaName ?? 'Main',
		table: tableNumbers.join('+') || '—',
		tableNumbers,
		diningAreaId: r.diningAreaId ?? null,
		status: stateMap[r.state] ?? 'confirmed',
		server: r.server ?? '—',
		origin: r.origin ?? 'Web',
		tags: (Array.isArray(r.visitTags) ? r.visitTags : typeof r.visitTags === 'string' ? JSON.parse(r.visitTags) : []) as string[],
		note: r.guestRequest ?? '',
		venueNotes: r.venueNotes ?? '',
		seatedTime: r.seatedTime ?? null,
		doneTime: r.doneTime ?? null,
		arrivedTime: r.arrivedTime ?? null,
		spend,
		exp,
		guestId: r.guestId,
	};
}

export type NormalizedReservation = ReturnType<typeof normalizeReservation>;

export function normalizeGuest(g: {
	id: string;
	firstName: string | null;
	lastName: string | null;
	email: string | null;
	phone: string | null;
	tags: string[] | null;
	notes: string | null;
	emailOptin: boolean | null;
	dateLastVisit: string | null;
	assignedTags?: string[];
}) {
	return {
		id: g.id,
		name: [g.firstName, g.lastName].filter(Boolean).join(' ') || 'Unknown',
		email: g.email ?? '',
		phone: g.phone ?? '',
		visits: 0,
		last: g.dateLastVisit ?? '',
		tags: g.assignedTags ?? g.tags ?? [],
		notes: g.notes ?? '',
		avgSpend: 0,
		optIn: g.emailOptin ?? false,
	};
}

export type NormalizedGuest = ReturnType<typeof normalizeGuest>;

export function normalizeTable(t: {
	id: string;
	tableNumber: string;
	minCovers: number | null;
	maxCovers: number;
	status: string | null;
	positionX: number | null;
	positionY: number | null;
	shape: string | null;
	active: boolean | null;
	areaName: string | null;
}) {
	const shapeMap: Record<string, string> = { square: 'rect', rectangle: 'rect', round: 'round', rect: 'rect' };

	return {
		id: t.tableNumber,
		dbId: t.id,
		area: t.areaName ?? 'Main',
		x: (t.positionX ?? 50) as number,
		y: (t.positionY ?? 50) as number,
		shape: (shapeMap[t.shape ?? 'square'] ?? 'rect') as 'round' | 'rect',
		seats: t.maxCovers,
		minSeats: t.minCovers ?? 1,
		status: (t.status ?? 'available') as 'available' | 'reserved' | 'seated' | 'dirty' | 'blocked' | 'no-show',
		active: t.active ?? true,
	};
}

export type NormalizedTable = ReturnType<typeof normalizeTable>;

export function normalizeShift(s: {
	id: string;
	name: string;
	dayOfWeek: number;
	startTime: string;
	endTime: string;
	slotIntervalMinutes: number | null;
	maxCoversPerSlot: number | null;
}) {
	const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	return {
		id: s.id,
		name: s.name,
		day: dayNames[s.dayOfWeek] ?? 'Mon',
		dayOfWeek: s.dayOfWeek,
		start: s.startTime,
		end: s.endTime,
		interval: s.slotIntervalMinutes ?? 15,
		max: s.maxCoversPerSlot ?? 60,
		color: s.name.toLowerCase().includes('lunch') ? 'lunch' as const
			: s.name.toLowerCase().includes('brunch') ? 'brunch' as const
			: 'dinner' as const,
	};
}

export type NormalizedShift = ReturnType<typeof normalizeShift>;

export function normalizeExperience(e: {
	id: string;
	name: string;
	description: string | null;
	prepaid: boolean | null;
	active: boolean | null;
	priceFrom: number;
	priceTo: number;
}) {
	return {
		id: e.id,
		name: e.name,
		desc: e.description ?? '',
		priceFrom: e.priceFrom / 100,
		priceTo: e.priceTo / 100,
		prepaid: e.prepaid ?? false,
		active: e.active ?? true,
		bookings30: 0,
	};
}

export type NormalizedExperience = ReturnType<typeof normalizeExperience>;

export function normalizeReview(r: {
	id: string;
	customerNickname: string | null;
	dinerInitials: string | null;
	ratingOverall: number | null;
	ratingFood: number | null;
	ratingService: number | null;
	ratingAmbience: number | null;
	ratingValue: number | null;
	reviewText: string | null;
	dinedDateTime: string | null;
	categories: Array<{ Id: string; Label: string }> | null;
	source: string | null;
	reply: { message: string; name: string | null } | null;
}) {
	return {
		id: r.id,
		name: r.customerNickname ?? 'Anonymous',
		initials: r.dinerInitials ?? (r.customerNickname?.slice(0, 2).toUpperCase() ?? 'AN'),
		overall: r.ratingOverall ?? 0,
		food: r.ratingFood ?? 0,
		service: r.ratingService ?? 0,
		ambience: r.ratingAmbience ?? 0,
		value: r.ratingValue ?? 0,
		text: r.reviewText ?? '',
		date: r.dinedDateTime?.slice(0, 10) ?? '',
		tags: (r.categories ?? []).map(c => c.Label),
		source: r.source ?? 'internal',
		reply: r.reply ? { text: r.reply.message, author: r.reply.name ?? 'Restaurant' } : null,
	};
}

export type NormalizedReview = ReturnType<typeof normalizeReview>;

export function normalizeSection(s: {
	id: string;
	name: string;
	staffId: string;
	staffName: string | null;
	shiftId: string | null;
	date: string;
	color: string;
	active: boolean | null;
	tableIds: string[];
}) {
	return {
		id: s.id,
		name: s.name,
		staffId: s.staffId,
		staffName: s.staffName ?? 'Unassigned',
		shiftId: s.shiftId,
		date: s.date,
		color: s.color,
		active: s.active ?? true,
		tableIds: s.tableIds,
	};
}

export type NormalizedSection = ReturnType<typeof normalizeSection>;
