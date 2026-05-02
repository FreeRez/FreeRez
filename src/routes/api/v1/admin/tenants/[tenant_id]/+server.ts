import type { RequestHandler, RequestEvent } from './$types';
import { eq, sql } from 'drizzle-orm';
import {
	tenants,
	tenantMembers,
	tenantRestaurants,
	tenantDatabases
} from '$lib/server/control-plane/schema';
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
	const tenantId = event.params.tenant_id;

	const rows = await cpDb
		.select()
		.from(tenants)
		.where(eq(tenants.id, tenantId))
		.limit(1);

	if (rows.length === 0) {
		return apiError('Tenant not found', 404);
	}

	const tenant = rows[0];

	const [memberCount] = await cpDb
		.select({ count: sql<number>`count(*)` })
		.from(tenantMembers)
		.where(eq(tenantMembers.tenantId, tenantId));

	const [restaurantCount] = await cpDb
		.select({ count: sql<number>`count(*)` })
		.from(tenantRestaurants)
		.where(eq(tenantRestaurants.tenantId, tenantId));

	const dbRows = await cpDb
		.select()
		.from(tenantDatabases)
		.where(eq(tenantDatabases.tenantId, tenantId))
		.limit(1);

	return apiSuccess({
		...tenant,
		memberCount: memberCount?.count ?? 0,
		restaurantCount: restaurantCount?.count ?? 0,
		database: dbRows[0] ?? null
	});
};

export const PUT: RequestHandler = async (event) => {
	if (!requireAdmin(event)) return apiError('Unauthorized', 401);

	const cpDb = event.locals.cpDb;
	const tenantId = event.params.tenant_id;

	let body: {
		name?: string;
		plan?: string;
		status?: string;
		maxRestaurants?: number;
	};

	try {
		body = await event.request.json();
	} catch {
		return apiError('Invalid JSON body', 400);
	}

	// Verify tenant exists
	const existing = await cpDb
		.select({ id: tenants.id })
		.from(tenants)
		.where(eq(tenants.id, tenantId))
		.limit(1);

	if (existing.length === 0) {
		return apiError('Tenant not found', 404);
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

	if (body.plan !== undefined) {
		const validPlans = ['free', 'starter', 'professional', 'enterprise'];
		if (!validPlans.includes(body.plan)) {
			return apiError(`plan must be one of: ${validPlans.join(', ')}`, 400);
		}
		updates.plan = body.plan;
	}

	if (body.status !== undefined) {
		const validStatuses = ['active', 'suspended', 'cancelled'];
		if (!validStatuses.includes(body.status)) {
			return apiError(`status must be one of: ${validStatuses.join(', ')}`, 400);
		}
		updates.status = body.status;
	}

	if (body.maxRestaurants !== undefined) {
		if (typeof body.maxRestaurants !== 'number' || body.maxRestaurants < 1) {
			return apiError('maxRestaurants must be a positive integer', 400);
		}
		updates.maxRestaurants = body.maxRestaurants;
	}

	const [updated] = await cpDb
		.update(tenants)
		.set(updates)
		.where(eq(tenants.id, tenantId))
		.returning();

	return apiSuccess(updated);
};

export const DELETE: RequestHandler = async (event) => {
	if (!requireAdmin(event)) return apiError('Unauthorized', 401);

	const cpDb = event.locals.cpDb;
	const tenantId = event.params.tenant_id;

	const existing = await cpDb
		.select({ id: tenants.id })
		.from(tenants)
		.where(eq(tenants.id, tenantId))
		.limit(1);

	if (existing.length === 0) {
		return apiError('Tenant not found', 404);
	}

	const [updated] = await cpDb
		.update(tenants)
		.set({
			status: 'cancelled',
			updatedAt: new Date().toISOString()
		})
		.where(eq(tenants.id, tenantId))
		.returning();

	return apiSuccess(updated);
};
