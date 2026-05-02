import type { RequestHandler, RequestEvent } from './$types';
import { eq } from 'drizzle-orm';
import { apiClients } from '$lib/server/control-plane/schema';
import { apiError, apiSuccess } from '$api/helpers';

function requireAdmin(event: RequestEvent): boolean {
	const key = event.request.headers.get('X-Admin-Key');
	const expected = (event.platform?.env as unknown as Record<string, string>)?.ADMIN_API_KEY;
	if (!expected || !key || key !== expected) return false;
	return true;
}

export const GET: RequestHandler = async (event) => {
	if (!requireAdmin(event)) return apiError('Unauthorized', 401);

	const cpDb = event.locals.cpDb;
	const clientId = event.params.client_id;

	const rows = await cpDb
		.select({
			id: apiClients.id,
			tenantId: apiClients.tenantId,
			clientId: apiClients.clientId,
			name: apiClients.name,
			partnerId: apiClients.partnerId,
			scope: apiClients.scope,
			tier: apiClients.tier,
			allowedRids: apiClients.allowedRids,
			active: apiClients.active,
			createdAt: apiClients.createdAt,
			updatedAt: apiClients.updatedAt
		})
		.from(apiClients)
		.where(eq(apiClients.clientId, clientId))
		.limit(1);

	if (rows.length === 0) {
		return apiError('Client not found', 404);
	}

	return apiSuccess(rows[0]);
};

export const PUT: RequestHandler = async (event) => {
	if (!requireAdmin(event)) return apiError('Unauthorized', 401);

	const cpDb = event.locals.cpDb;
	const clientId = event.params.client_id;

	let body: {
		name?: string;
		tier?: string;
		scope?: string;
		allowedRids?: number[] | null;
		active?: boolean;
	};

	try {
		body = await event.request.json();
	} catch {
		return apiError('Invalid JSON body', 400);
	}

	// Verify client exists
	const existing = await cpDb
		.select({ id: apiClients.id })
		.from(apiClients)
		.where(eq(apiClients.clientId, clientId))
		.limit(1);

	if (existing.length === 0) {
		return apiError('Client not found', 404);
	}

	const updates: Record<string, unknown> = {
		updatedAt: new Date().toISOString()
	};

	if (body.name !== undefined) {
		if (typeof body.name !== 'string' || body.name.trim().length === 0) {
			return apiError('name must be a non-empty string', 400);
		}
		updates.name = body.name.trim();
	}

	if (body.tier !== undefined) {
		const validTiers = ['copper', 'gold', 'platinum'];
		if (!validTiers.includes(body.tier)) {
			return apiError(`tier must be one of: ${validTiers.join(', ')}`, 400);
		}
		updates.tier = body.tier;
	}

	if (body.scope !== undefined) {
		if (typeof body.scope !== 'string') {
			return apiError('scope must be a string', 400);
		}
		updates.scope = body.scope;
	}

	if (body.allowedRids !== undefined) {
		if (
			body.allowedRids !== null &&
			(!Array.isArray(body.allowedRids) ||
				!body.allowedRids.every((r) => typeof r === 'number'))
		) {
			return apiError('allowedRids must be an array of numbers or null', 400);
		}
		updates.allowedRids = body.allowedRids;
	}

	if (body.active !== undefined) {
		if (typeof body.active !== 'boolean') {
			return apiError('active must be a boolean', 400);
		}
		updates.active = body.active;
	}

	const [updated] = await cpDb
		.update(apiClients)
		.set(updates)
		.where(eq(apiClients.clientId, clientId))
		.returning({
			id: apiClients.id,
			tenantId: apiClients.tenantId,
			clientId: apiClients.clientId,
			name: apiClients.name,
			partnerId: apiClients.partnerId,
			scope: apiClients.scope,
			tier: apiClients.tier,
			allowedRids: apiClients.allowedRids,
			active: apiClients.active,
			createdAt: apiClients.createdAt,
			updatedAt: apiClients.updatedAt
		});

	return apiSuccess(updated);
};

export const DELETE: RequestHandler = async (event) => {
	if (!requireAdmin(event)) return apiError('Unauthorized', 401);

	const cpDb = event.locals.cpDb;
	const clientId = event.params.client_id;

	const existing = await cpDb
		.select({ id: apiClients.id })
		.from(apiClients)
		.where(eq(apiClients.clientId, clientId))
		.limit(1);

	if (existing.length === 0) {
		return apiError('Client not found', 404);
	}

	const [updated] = await cpDb
		.update(apiClients)
		.set({
			active: false,
			updatedAt: new Date().toISOString()
		})
		.where(eq(apiClients.clientId, clientId))
		.returning({
			id: apiClients.id,
			tenantId: apiClients.tenantId,
			clientId: apiClients.clientId,
			name: apiClients.name,
			partnerId: apiClients.partnerId,
			scope: apiClients.scope,
			tier: apiClients.tier,
			allowedRids: apiClients.allowedRids,
			active: apiClients.active,
			createdAt: apiClients.createdAt,
			updatedAt: apiClients.updatedAt
		});

	return apiSuccess(updated);
};
