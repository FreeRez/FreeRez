import { eq, and, gte, lte, like, sql } from 'drizzle-orm';
import { restaurants, reservations, slotLocks, guests, guestTagAssignments, guestTagDefinitions } from '$db/schema';
import { calculateAvailability } from '$api/availability-engine';
import type { Database } from '$db';

// ─── Shared Types ───────────────────────────────────────────────────────────

type ToolResult = {
	content: Array<{ type: 'text'; text: string }>;
	isError?: boolean;
};

function textResult(text: string): ToolResult {
	return { content: [{ type: 'text', text }] };
}

function errorResult(message: string): ToolResult {
	return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
}

async function resolveRestaurant(db: Database, rid: number) {
	const rows = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);
	return rows[0] ?? null;
}

// ─── check_availability ─────────────────────────────────────────────────────

export async function handleCheckAvailability(
	db: Database,
	args: { rid: number; date: string; time?: string; party_size: number; forward_minutes?: number }
): Promise<ToolResult> {
	const { rid, date, party_size, forward_minutes = 180 } = args;
	const time = args.time ?? '19:00';
	const startDateTime = `${date}T${time}`;

	const result = await calculateAvailability({
		db,
		restaurantId: '',
		rid,
		startDateTime,
		forwardMinutes: forward_minutes,
		backwardMinutes: 60,
		partySize: party_size,
		includeExperiences: false
	});

	if (!result) return errorResult('Restaurant not found');

	const available = result.slots.filter((s) => s.canSeatParty);
	if (available.length === 0) {
		return textResult(
			`No available time slots found at ${result.restaurant.name} on ${date} for a party of ${party_size} near ${time}.`
		);
	}

	const slotSummaries = available.map((s) => {
		const tableCount = s.availableTables.length;
		const areas = [...new Set(s.availableTables.map((t) => t.environment).filter(Boolean))];
		return `  ${s.time} - ${tableCount} table${tableCount !== 1 ? 's' : ''} available${areas.length > 0 ? ` (${areas.join(', ')})` : ''}`;
	});

	return textResult(
		`Found ${available.length} available slot${available.length !== 1 ? 's' : ''} at ${result.restaurant.name} on ${date} for ${party_size} guest${party_size !== 1 ? 's' : ''}:\n\n${slotSummaries.join('\n')}`
	);
}

// ─── make_reservation ───────────────────────────────────────────────────────

export async function handleMakeReservation(
	db: Database,
	args: {
		rid: number;
		date_time: string;
		party_size: number;
		first_name: string;
		last_name: string;
		email?: string;
		phone?: string;
		special_request?: string;
	}
): Promise<ToolResult> {
	const { rid, date_time, party_size, first_name, last_name, email, phone, special_request } =
		args;

	const restaurant = await resolveRestaurant(db, rid);
	if (!restaurant) return errorResult('Restaurant not found');

	// Step 1: Create a slot lock (same flow as the API)
	const reservationToken = crypto.randomUUID();
	const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

	await db.insert(slotLocks).values({
		restaurantId: restaurant.id,
		reservationToken,
		partySize: party_size,
		dateTime: date_time,
		reservationAttribute: 'default',
		diningAreaId: null,
		environment: null,
		expiresAt
	});

	// Step 2: Find or create guest
	let guestId: string | null = null;
	if (email) {
		const existingGuests = await db
			.select()
			.from(guests)
			.where(and(eq(guests.restaurantId, restaurant.id), eq(guests.email, email)))
			.limit(1);

		if (existingGuests.length > 0) {
			guestId = existingGuests[0].id;
			await db
				.update(guests)
				.set({
					firstName: first_name,
					lastName: last_name,
					phone: phone ?? existingGuests[0].phone,
					updatedAt: new Date().toISOString()
				})
				.where(eq(guests.id, guestId));
		} else {
			const newGuest = await db
				.insert(guests)
				.values({
					restaurantId: restaurant.id,
					rid,
					firstName: first_name,
					lastName: last_name,
					email,
					phone: phone ?? null
				})
				.returning();
			guestId = newGuest[0].id;
		}
	}

	// Step 3: Create reservation
	const confirmationId = Math.floor(Math.random() * 2147483647);
	const now = new Date().toISOString();

	await db.insert(reservations).values({
		restaurantId: restaurant.id,
		rid,
		guestId,
		confirmationId,
		state: 'Confirmed',
		partySize: party_size,
		scheduledTime: date_time,
		scheduledTimeUtc: date_time,
		reservationAttribute: 'default',
		origin: 'App',
		guestRequest: special_request ?? null,
		createdAt: now,
		updatedAt: now,
		createdAtUtc: now,
		updatedAtUtc: now
	});

	// Step 4: Delete the slot lock
	await db
		.delete(slotLocks)
		.where(eq(slotLocks.reservationToken, reservationToken));

	return textResult(
		`Reservation confirmed at ${restaurant.name}!\n\n` +
			`  Confirmation #: ${confirmationId}\n` +
			`  Date/Time: ${date_time}\n` +
			`  Party Size: ${party_size}\n` +
			`  Guest: ${first_name} ${last_name}\n` +
			(special_request ? `  Special Request: ${special_request}\n` : '')
	);
}

// ─── cancel_reservation ─────────────────────────────────────────────────────

export async function handleCancelReservation(
	db: Database,
	args: { rid: number; confirmation_number: number }
): Promise<ToolResult> {
	const { rid, confirmation_number } = args;

	const restaurant = await resolveRestaurant(db, rid);
	if (!restaurant) return errorResult('Restaurant not found');

	const results = await db
		.select()
		.from(reservations)
		.where(
			and(
				eq(reservations.restaurantId, restaurant.id),
				eq(reservations.confirmationId, confirmation_number)
			)
		)
		.limit(1);

	if (results.length === 0) return errorResult('Reservation not found');

	const reservation = results[0];
	if (reservation.state === 'Cancelled' || reservation.state === 'CancelledWeb') {
		return errorResult('Reservation is already cancelled');
	}

	const now = new Date().toISOString();
	await db
		.update(reservations)
		.set({
			state: 'CancelledWeb',
			cancellationDate: now,
			cancellationDateUtc: now,
			updatedAt: now,
			updatedAtUtc: now
		})
		.where(eq(reservations.id, reservation.id));

	return textResult(
		`Reservation #${confirmation_number} has been cancelled.\n\n` +
			`  Original Time: ${reservation.scheduledTime}\n` +
			`  Party Size: ${reservation.partySize}`
	);
}

// ─── modify_reservation ─────────────────────────────────────────────────────

export async function handleModifyReservation(
	db: Database,
	args: {
		rid: number;
		confirmation_number: number;
		date_time?: string;
		party_size?: number;
		special_request?: string;
	}
): Promise<ToolResult> {
	const { rid, confirmation_number, date_time, party_size, special_request } = args;

	const restaurant = await resolveRestaurant(db, rid);
	if (!restaurant) return errorResult('Restaurant not found');

	const results = await db
		.select()
		.from(reservations)
		.where(
			and(
				eq(reservations.restaurantId, restaurant.id),
				eq(reservations.confirmationId, confirmation_number)
			)
		)
		.limit(1);

	if (results.length === 0) return errorResult('Reservation not found');

	const reservation = results[0];
	if (reservation.state === 'Cancelled' || reservation.state === 'CancelledWeb') {
		return errorResult('Cannot modify a cancelled reservation');
	}

	const now = new Date().toISOString();
	const updateData: Record<string, unknown> = {
		updatedAt: now,
		updatedAtUtc: now
	};

	if (date_time !== undefined) {
		updateData.scheduledTime = date_time;
		updateData.scheduledTimeUtc = date_time;
	}
	if (party_size !== undefined) updateData.partySize = party_size;
	if (special_request !== undefined) updateData.guestRequest = special_request;

	await db.update(reservations).set(updateData).where(eq(reservations.id, reservation.id));

	const changes: string[] = [];
	if (date_time) changes.push(`Time: ${date_time}`);
	if (party_size) changes.push(`Party Size: ${party_size}`);
	if (special_request !== undefined) changes.push(`Special Request: ${special_request || '(cleared)'}`);

	return textResult(
		`Reservation #${confirmation_number} has been modified.\n\n` +
			`  Updated:\n${changes.map((c) => `    ${c}`).join('\n')}`
	);
}

// ─── search_reservations ────────────────────────────────────────────────────

export async function handleSearchReservations(
	db: Database,
	args: { rid: number; guest_name?: string; phone?: string; date?: string }
): Promise<ToolResult> {
	const { rid, guest_name, phone, date } = args;

	const restaurant = await resolveRestaurant(db, rid);
	if (!restaurant) return errorResult('Restaurant not found');

	// Build query with joins to get guest info
	const conditions: ReturnType<typeof eq>[] = [
		eq(reservations.restaurantId, restaurant.id),
		sql`${reservations.state} NOT IN ('Cancelled', 'CancelledWeb')`
	];

	if (date) {
		conditions.push(gte(reservations.scheduledTime, `${date}T00:00`));
		conditions.push(lte(reservations.scheduledTime, `${date}T23:59`));
	}

	const rows = await db
		.select()
		.from(reservations)
		.leftJoin(guests, eq(reservations.guestId, guests.id))
		.where(and(...conditions))
		.limit(50);

	let filtered = rows;

	// Filter by guest name (LIKE on first + last name)
	if (guest_name) {
		const nameLower = guest_name.toLowerCase();
		filtered = filtered.filter((row) => {
			const g = row.guests;
			if (!g) return false;
			const fullName = `${g.firstName ?? ''} ${g.lastName ?? ''}`.toLowerCase();
			return fullName.includes(nameLower);
		});
	}

	// Filter by phone
	if (phone) {
		const phoneDigits = phone.replace(/\D/g, '');
		filtered = filtered.filter((row) => {
			const g = row.guests;
			if (!g || !g.phone) return false;
			return g.phone.replace(/\D/g, '').includes(phoneDigits);
		});
	}

	if (filtered.length === 0) {
		return textResult('No reservations found matching the search criteria.');
	}

	const summaries = filtered.map((row) => {
		const r = row.reservations;
		const g = row.guests;
		const guestName = g ? `${g.firstName ?? ''} ${g.lastName ?? ''}`.trim() : 'Unknown Guest';
		return `  #${r.confirmationId} | ${guestName} | ${r.scheduledTime} | Party of ${r.partySize} | ${r.state}`;
	});

	return textResult(
		`Found ${filtered.length} reservation${filtered.length !== 1 ? 's' : ''}:\n\n${summaries.join('\n')}`
	);
}

// ─── get_restaurant_info ────────────────────────────────────────────────────

export async function handleGetRestaurantInfo(
	db: Database,
	args: { rid: number }
): Promise<ToolResult> {
	const restaurant = await resolveRestaurant(db, args.rid);
	if (!restaurant) return errorResult('Restaurant not found');

	const lines: string[] = [
		`${restaurant.name}`,
		'',
		restaurant.description ? `${restaurant.description}` : '',
		restaurant.primaryCuisine ? `Cuisine: ${restaurant.primaryCuisine}` : '',
		restaurant.diningStyle ? `Dining Style: ${restaurant.diningStyle}` : '',
		restaurant.dressCode ? `Dress Code: ${restaurant.dressCode}` : '',
		restaurant.executiveChef ? `Executive Chef: ${restaurant.executiveChef}` : '',
		'',
		'Contact:',
		restaurant.phone ? `  Phone: ${restaurant.phone}` : '',
		restaurant.website ? `  Website: ${restaurant.website}` : '',
		'',
		'Location:',
		restaurant.address ? `  ${restaurant.address}` : '',
		restaurant.address2 ? `  ${restaurant.address2}` : '',
		[restaurant.city, restaurant.state, restaurant.postalCode].filter(Boolean).join(', ')
			? `  ${[restaurant.city, restaurant.state, restaurant.postalCode].filter(Boolean).join(', ')}`
			: '',
		restaurant.crossStreet ? `  Cross Street: ${restaurant.crossStreet}` : '',
		restaurant.neighborhoodName ? `  Neighborhood: ${restaurant.neighborhoodName}` : ''
	];

	if (restaurant.openingTimes) {
		lines.push('', 'Hours:');
		const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
		for (const [day, periods] of Object.entries(restaurant.openingTimes)) {
			const dayIndex = parseInt(day, 10);
			const dayName = dayNames[dayIndex] ?? day;
			const times = (periods as Array<{ start: string; end: string }>)
				.map((p) => `${p.start}-${p.end}`)
				.join(', ');
			lines.push(`  ${dayName}: ${times}`);
		}
	}

	return textResult(lines.filter((l) => l !== '').join('\n'));
}

// ─── list_today_reservations ────────────────────────────────────────────────

export async function handleListTodayReservations(
	db: Database,
	args: { rid: number; date?: string }
): Promise<ToolResult> {
	const restaurant = await resolveRestaurant(db, args.rid);
	if (!restaurant) return errorResult('Restaurant not found');

	const date = args.date ?? new Date().toISOString().split('T')[0];

	const rows = await db
		.select()
		.from(reservations)
		.leftJoin(guests, eq(reservations.guestId, guests.id))
		.where(
			and(
				eq(reservations.restaurantId, restaurant.id),
				gte(reservations.scheduledTime, `${date}T00:00`),
				lte(reservations.scheduledTime, `${date}T23:59`),
				sql`${reservations.state} NOT IN ('Cancelled', 'CancelledWeb')`
			)
		)
		.limit(200);

	if (rows.length === 0) {
		return textResult(`No reservations found at ${restaurant.name} for ${date}.`);
	}

	// Sort by scheduled time
	const sorted = rows.sort((a, b) =>
		a.reservations.scheduledTime.localeCompare(b.reservations.scheduledTime)
	);

	const statusCounts: Record<string, number> = {};
	let totalCovers = 0;
	const lines: string[] = [];

	for (const row of sorted) {
		const r = row.reservations;
		const g = row.guests;
		const guestName = g ? `${g.firstName ?? ''} ${g.lastName ?? ''}`.trim() : 'Unknown Guest';
		const time = r.scheduledTime.split('T')[1] ?? r.scheduledTime;

		statusCounts[r.state] = (statusCounts[r.state] ?? 0) + 1;
		totalCovers += r.partySize;

		lines.push(
			`  ${time} | #${r.confirmationId} | ${guestName} | Party of ${r.partySize} | ${r.state}${r.guestRequest ? ` | Note: ${r.guestRequest}` : ''}`
		);
	}

	const statusSummary = Object.entries(statusCounts)
		.map(([state, count]) => `${state}: ${count}`)
		.join(', ');

	return textResult(
		`${restaurant.name} - Reservations for ${date}\n` +
			`${rows.length} reservation${rows.length !== 1 ? 's' : ''}, ${totalCovers} total covers (${statusSummary})\n\n` +
			lines.join('\n')
	);
}

// ─── get_guest_profile ──────────────────────────────────────────────────────

export async function handleGetGuestProfile(
	db: Database,
	args: { rid: number; guest_name?: string; email?: string; phone?: string }
): Promise<ToolResult> {
	const { rid, guest_name, email, phone } = args;

	const restaurant = await resolveRestaurant(db, rid);
	if (!restaurant) return errorResult('Restaurant not found');

	const conditions: ReturnType<typeof eq>[] = [eq(guests.restaurantId, restaurant.id)];

	if (email) {
		conditions.push(eq(guests.email, email));
	} else if (phone) {
		conditions.push(eq(guests.phone, phone));
	} else if (guest_name) {
		// Search by name - try to match on firstName + lastName
		const parts = guest_name.trim().split(/\s+/);
		if (parts.length >= 2) {
			conditions.push(like(guests.firstName, `%${parts[0]}%`));
			conditions.push(like(guests.lastName, `%${parts.slice(1).join(' ')}%`));
		} else {
			conditions.push(
				sql`(${guests.firstName} LIKE ${'%' + guest_name + '%'} OR ${guests.lastName} LIKE ${'%' + guest_name + '%'})`
			);
		}
	} else {
		return errorResult('At least one of guest_name, email, or phone is required');
	}

	const guestRows = await db
		.select()
		.from(guests)
		.where(and(...conditions))
		.limit(5);

	if (guestRows.length === 0) {
		return textResult('No guest profile found matching the search criteria.');
	}

	const profiles: string[] = [];

	for (const guest of guestRows) {
		const lines: string[] = [
			`${guest.firstName ?? ''} ${guest.lastName ?? ''}`.trim(),
			''
		];

		if (guest.email) lines.push(`Email: ${guest.email}`);
		if (guest.phone) lines.push(`Phone: ${guest.phone}`);
		if (guest.companyName) lines.push(`Company: ${guest.companyName}`);
		if (guest.birthDate) lines.push(`Birthday: ${guest.birthDate}`);
		if (guest.dateFirstVisit) lines.push(`First Visit: ${guest.dateFirstVisit}`);
		if (guest.dateLastVisit) lines.push(`Last Visit: ${guest.dateLastVisit}`);

		// Get tags
		const tagRows = await db
			.select({ displayName: guestTagDefinitions.displayName, category: guestTagDefinitions.category })
			.from(guestTagAssignments)
			.innerJoin(guestTagDefinitions, eq(guestTagAssignments.tagId, guestTagDefinitions.tagId))
			.where(eq(guestTagAssignments.guestId, guest.id))
			.limit(20);

		if (tagRows.length > 0) {
			lines.push('', 'Tags:');
			for (const tag of tagRows) {
				lines.push(`  [${tag.category}] ${tag.displayName}`);
			}
		}

		// Notes
		const notes: string[] = [];
		if (guest.notes) notes.push(`General: ${guest.notes}`);
		if (guest.notesFoodAndDrink) notes.push(`Food & Drink: ${guest.notesFoodAndDrink}`);
		if (guest.notesSeating) notes.push(`Seating: ${guest.notesSeating}`);
		if (guest.notesSpecialRelationship) notes.push(`Special: ${guest.notesSpecialRelationship}`);
		if (notes.length > 0) {
			lines.push('', 'Notes:');
			for (const note of notes) {
				lines.push(`  ${note}`);
			}
		}

		// Recent reservations
		const recentRes = await db
			.select()
			.from(reservations)
			.where(
				and(
					eq(reservations.restaurantId, restaurant.id),
					eq(reservations.guestId, guest.id)
				)
			)
			.orderBy(sql`${reservations.scheduledTime} DESC`)
			.limit(5);

		if (recentRes.length > 0) {
			lines.push('', 'Recent Reservations:');
			for (const r of recentRes) {
				lines.push(`  ${r.scheduledTime} | Party of ${r.partySize} | ${r.state}`);
			}
		}

		profiles.push(lines.join('\n'));
	}

	return textResult(
		guestRows.length === 1
			? profiles[0]
			: `Found ${guestRows.length} matching guests:\n\n${profiles.join('\n\n---\n\n')}`
	);
}

// ─── Tool Dispatcher ────────────────────────────────────────────────────────

export async function executeToolCall(
	toolName: string,
	args: Record<string, unknown>,
	db: Database
): Promise<ToolResult> {
	switch (toolName) {
		case 'check_availability':
			return handleCheckAvailability(db, args as Parameters<typeof handleCheckAvailability>[1]);
		case 'make_reservation':
			return handleMakeReservation(db, args as Parameters<typeof handleMakeReservation>[1]);
		case 'cancel_reservation':
			return handleCancelReservation(db, args as Parameters<typeof handleCancelReservation>[1]);
		case 'modify_reservation':
			return handleModifyReservation(db, args as Parameters<typeof handleModifyReservation>[1]);
		case 'search_reservations':
			return handleSearchReservations(db, args as Parameters<typeof handleSearchReservations>[1]);
		case 'get_restaurant_info':
			return handleGetRestaurantInfo(db, args as Parameters<typeof handleGetRestaurantInfo>[1]);
		case 'list_today_reservations':
			return handleListTodayReservations(
				db,
				args as Parameters<typeof handleListTodayReservations>[1]
			);
		case 'get_guest_profile':
			return handleGetGuestProfile(db, args as Parameters<typeof handleGetGuestProfile>[1]);
		default:
			return errorResult(`Unknown tool: ${toolName}`);
	}
}
