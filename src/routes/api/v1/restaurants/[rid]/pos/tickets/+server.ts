import type { RequestHandler } from './$types';
import { eq, and, gte, lte } from 'drizzle-orm';
import { restaurants, posTickets } from '$db/schema';
import { getAuthContext, apiError, apiSuccess, requireAuthorizedRid, parseIntParam, parseJsonBody } from '$api/helpers';

export const GET: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;
	const auth = getAuthContext(event)!;

	const db = event.locals.db;
	const { url } = event;

	const updatedFrom = url.searchParams.get('updated_from');
	const updatedTo = url.searchParams.get('updated_to');
	const limit = parseIntParam(url.searchParams.get('limit'), 50);
	const offset = parseIntParam(url.searchParams.get('offset'), 0);

	// Resolve restaurant
	const rest = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);

	if (rest.length === 0) return apiError('Restaurant not found', 404);
	const restaurant = rest[0];

	// Build query conditions
	const conditions = [eq(posTickets.restaurantId, restaurant.id)];

	if (updatedFrom) {
		conditions.push(gte(posTickets.updatedAt, updatedFrom));
	}
	if (updatedTo) {
		conditions.push(lte(posTickets.updatedAt, updatedTo));
	}

	const tickets = await db
		.select()
		.from(posTickets)
		.where(and(...conditions));

	const total = tickets.length;
	const paged = tickets.slice(offset, offset + limit);

	const hasNextPage = offset + limit < total;
	const nextPageUrl = hasNextPage
		? `${url.pathname}?updated_from=${updatedFrom ?? ''}&updated_to=${updatedTo ?? ''}&limit=${limit}&offset=${offset + limit}`
		: null;

	return apiSuccess({
		timestamp: new Date().toISOString(),
		limit,
		offset,
		next_page_url: nextPageUrl,
		tickets: paged.map((t) => ({
			ticket: {
				ticket_id: t.ticketId,
				ticket_number: t.ticketNumber,
				opened_at: t.openedAt,
				updated_at: t.updatedAt,
				closed_at: t.closedAt,
				party_size: t.partySize,
				order_type: t.orderType,
				order_items: t.orderItems,
				payments: t.payments
			}
		}))
	});
};

interface MenuCategory {
	id: string;
	level: number;
	name: string;
	parent_menu_category?: MenuCategory;
}

interface OrderItem {
	id: string;
	name: string;
	price: number;
	quantity: number;
	sent_at: string;
	status: string;
	item: {
		id: string;
		name: string;
		price: number;
		categories: MenuCategory[];
		open?: boolean;
	};
	modifiers: Array<{ id: string; name: string; price: number; quantity: number }>;
	server_note?: string | null;
}

interface Payment {
	id: string;
	type: string;
	amount: number;
	tip_amount: number;
	refund_amount: number;
}

interface TicketBody {
	timestamp: string;
	operation: 'create' | 'update' | 'close';
	ticket: {
		ticket_id: string;
		ticket_number?: string;
		opened_at?: string;
		updated_at?: string;
		closed_at?: string;
		party_size?: number;
		order_type?: string;
		order_items?: OrderItem[];
		payments?: Payment[];
	};
}

export const POST: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;
	const auth = getAuthContext(event)!;

	const db = event.locals.db;

	const parsed = await parseJsonBody<TicketBody>(event);
	if ('error' in parsed) return parsed.error;
	const body = parsed.data;

	if (!body.ticket?.ticket_id) {
		return apiError('ticket.ticket_id is required', 400);
	}

	if (!body.operation || !['create', 'update', 'close'].includes(body.operation)) {
		return apiError('operation must be one of: create, update, close', 400);
	}

	// Resolve restaurant
	const rest = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);

	if (rest.length === 0) return apiError('Restaurant not found', 404);
	const restaurant = rest[0];

	const ticket = body.ticket;
	const timestampDate = body.timestamp ? body.timestamp.split('T')[0] : new Date().toISOString().split('T')[0];
	const itemStatuses: Array<{ itemId: string; status: string }> = [];

	if (body.operation === 'create') {
		await db.insert(posTickets).values({
			restaurantId: restaurant.id,
			rid,
			ticketId: ticket.ticket_id,
			ticketNumber: ticket.ticket_number ?? null,
			openedAt: ticket.opened_at ?? null,
			closedAt: ticket.closed_at ?? null,
			updatedAt: ticket.updated_at ?? new Date().toISOString(),
			partySize: ticket.party_size ?? null,
			orderType: ticket.order_type ?? null,
			orderItems: ticket.order_items ?? null,
			payments: ticket.payments ?? null
		});

		itemStatuses.push({ itemId: `${ticket.ticket_id}:${timestampDate}`, status: 'Processing' });
	} else if (body.operation === 'update' || body.operation === 'close') {
		const existing = await db
			.select()
			.from(posTickets)
			.where(
				and(eq(posTickets.restaurantId, restaurant.id), eq(posTickets.ticketId, ticket.ticket_id))
			)
			.limit(1);

		if (existing.length === 0) {
			return apiError('Ticket not found', 404);
		}

		await db
			.update(posTickets)
			.set({
				ticketNumber: ticket.ticket_number ?? existing[0].ticketNumber,
				openedAt: ticket.opened_at ?? existing[0].openedAt,
				closedAt: ticket.closed_at ?? existing[0].closedAt,
				updatedAt: ticket.updated_at ?? new Date().toISOString(),
				partySize: ticket.party_size ?? existing[0].partySize,
				orderType: ticket.order_type ?? existing[0].orderType,
				orderItems: ticket.order_items ?? existing[0].orderItems,
				payments: ticket.payments ?? existing[0].payments
			})
			.where(
				and(eq(posTickets.restaurantId, restaurant.id), eq(posTickets.ticketId, ticket.ticket_id))
			);

		itemStatuses.push({ itemId: `${ticket.ticket_id}:${timestampDate}`, status: 'Processing' });
	}

	return apiSuccess({
		itemStatus: itemStatuses,
		totalItems: 1,
		totalProcessedItems: itemStatuses.length
	});
};
