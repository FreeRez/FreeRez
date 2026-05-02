import type { RequestHandler, RequestEvent } from './$types';
import { eq, sql } from 'drizzle-orm';
import { tenants, tenantDatabases, tenantMembers } from '$lib/server/control-plane/schema';
import { apiError, apiSuccess, parseIntParam } from '$api/helpers';

function requireAdmin(event: RequestEvent): boolean {
	const key = event.request.headers.get('X-Admin-Key');
	const expected = (event.platform?.env as unknown as Record<string, string>)?.ADMIN_API_KEY;
	if (!expected || !key || key !== expected) return false;
	return true;
}

export const GET: RequestHandler = async (event) => {
	if (!requireAdmin(event)) return apiError('Unauthorized', 401);

	const { url, locals } = event;
	const cpDb = locals.cpDb;

	const limit = parseIntParam(url.searchParams.get('limit'), 50);
	const offset = parseIntParam(url.searchParams.get('offset'), 0);
	const statusFilter = url.searchParams.get('status');

	let query = cpDb.select().from(tenants).$dynamic();

	if (statusFilter && ['active', 'suspended', 'cancelled'].includes(statusFilter)) {
		query = query.where(
			eq(tenants.status, statusFilter as 'active' | 'suspended' | 'cancelled')
		);
	}

	const rows = await query.limit(limit).offset(offset);

	const countResult = await cpDb
		.select({ count: sql<number>`count(*)` })
		.from(tenants);
	const total = countResult[0]?.count ?? 0;

	return apiSuccess({ tenants: rows, total });
};

export const POST: RequestHandler = async (event) => {
	if (!requireAdmin(event)) return apiError('Unauthorized', 401);

	const cpDb = event.locals.cpDb;

	let body: {
		name?: string;
		slug?: string;
		email?: string;
		plan?: string;
		maxRestaurants?: number;
	};

	try {
		body = await event.request.json();
	} catch {
		return apiError('Invalid JSON body', 400);
	}

	if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
		return apiError('name is required', 400);
	}
	if (!body.slug || typeof body.slug !== 'string' || body.slug.trim().length === 0) {
		return apiError('slug is required', 400);
	}
	if (!body.email || typeof body.email !== 'string' || body.email.trim().length === 0) {
		return apiError('email is required', 400);
	}
	if (!/^[a-z0-9-]+$/.test(body.slug)) {
		return apiError('slug must be lowercase alphanumeric with hyphens only', 400);
	}

	const validPlans = ['free', 'starter', 'professional', 'enterprise'] as const;
	const plan = body.plan ?? 'free';
	if (!validPlans.includes(plan as (typeof validPlans)[number])) {
		return apiError(`plan must be one of: ${validPlans.join(', ')}`, 400);
	}

	// Check slug uniqueness
	const existing = await cpDb
		.select({ id: tenants.id })
		.from(tenants)
		.where(eq(tenants.slug, body.slug))
		.limit(1);

	if (existing.length > 0) {
		return apiError('A tenant with this slug already exists', 409);
	}

	const tenantId = crypto.randomUUID();
	const now = new Date().toISOString();

	const [created] = await cpDb
		.insert(tenants)
		.values({
			id: tenantId,
			name: body.name.trim(),
			slug: body.slug.trim(),
			email: body.email.trim(),
			plan: plan as 'free' | 'starter' | 'professional' | 'enterprise',
			maxRestaurants: body.maxRestaurants ?? 1,
			status: 'active',
			createdAt: now,
			updatedAt: now
		})
		.returning();

	// Create tenant database record
	await cpDb.insert(tenantDatabases).values({
		tenantId,
		d1DatabaseId: 'default',
		d1DatabaseName: `freerez-${body.slug.trim()}`,
		region: 'auto',
		status: 'ready',
		schemaVersion: 0,
		createdAt: now,
		updatedAt: now
	});

	// Create owner membership
	await cpDb.insert(tenantMembers).values({
		tenantId,
		email: body.email.trim(),
		role: 'owner',
		inviteStatus: 'accepted',
		createdAt: now
	});

	return apiSuccess(created, 201);
};
