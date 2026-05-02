import type { RequestHandler, RequestEvent } from './$types';
import { eq, and } from 'drizzle-orm';
import { tenants, tenantRestaurants } from '$lib/server/control-plane/schema';
import { apiError, apiSuccess, parseIntParam } from '$api/helpers';

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
	const { url } = event;

	const limit = parseIntParam(url.searchParams.get('limit'), 50);
	const offset = parseIntParam(url.searchParams.get('offset'), 0);

	// Verify tenant exists
	const tenantRows = await cpDb
		.select({ id: tenants.id })
		.from(tenants)
		.where(eq(tenants.id, tenantId))
		.limit(1);

	if (tenantRows.length === 0) {
		return apiError('Tenant not found', 404);
	}

	const rows = await cpDb
		.select()
		.from(tenantRestaurants)
		.where(eq(tenantRestaurants.tenantId, tenantId))
		.limit(limit)
		.offset(offset);

	return apiSuccess({ restaurants: rows });
};

export const POST: RequestHandler = async (event) => {
	if (!requireAdmin(event)) return apiError('Unauthorized', 401);

	const cpDb = event.locals.cpDb;
	const tenantId = event.params.tenant_id;

	let body: {
		rid?: number;
		restaurantName?: string;
	};

	try {
		body = await event.request.json();
	} catch {
		return apiError('Invalid JSON body', 400);
	}

	if (body.rid === undefined || typeof body.rid !== 'number') {
		return apiError('rid is required and must be a number', 400);
	}
	if (
		!body.restaurantName ||
		typeof body.restaurantName !== 'string' ||
		body.restaurantName.trim().length === 0
	) {
		return apiError('restaurantName is required', 400);
	}

	// Verify tenant exists
	const tenantRows = await cpDb
		.select({ id: tenants.id })
		.from(tenants)
		.where(eq(tenants.id, tenantId))
		.limit(1);

	if (tenantRows.length === 0) {
		return apiError('Tenant not found', 404);
	}

	// Check for duplicate rid across all tenants
	const existingRid = await cpDb
		.select({ id: tenantRestaurants.id })
		.from(tenantRestaurants)
		.where(eq(tenantRestaurants.rid, body.rid))
		.limit(1);

	if (existingRid.length > 0) {
		return apiError('This rid is already registered to a tenant', 409);
	}

	// Verify the rid exists in the tenant's database
	// This uses the tenant-scoped DB from locals to confirm the restaurant exists
	try {
		const db = event.locals.db;
		const { restaurants } = await import('$db/schema');
		const restaurantRows = await db
			.select({ rid: restaurants.rid })
			.from(restaurants)
			.where(eq(restaurants.rid, body.rid))
			.limit(1);

		if (restaurantRows.length === 0) {
			return apiError('Restaurant with this rid does not exist in tenant database', 404);
		}
	} catch {
		// If tenant DB is not available (e.g., during initial setup),
		// skip verification and allow registration
	}

	const now = new Date().toISOString();

	const [created] = await cpDb
		.insert(tenantRestaurants)
		.values({
			tenantId,
			rid: body.rid,
			restaurantName: body.restaurantName.trim(),
			active: true,
			createdAt: now
		})
		.returning();

	return apiSuccess(created, 201);
};
