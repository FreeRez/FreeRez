import type { RequestHandler, RequestEvent } from './$types';
import { eq } from 'drizzle-orm';
import { apiClients, tenants } from '$lib/server/control-plane/schema';
import { apiError, apiSuccess, parseIntParam } from '$api/helpers';

function requireAdmin(event: RequestEvent): boolean {
	const key = event.request.headers.get('X-Admin-Key');
	const expected = (event.platform?.env as unknown as Record<string, string>)?.ADMIN_API_KEY;
	if (!expected || !key || key !== expected) return false;
	return true;
}

function generateHex(bytes: number): string {
	const array = new Uint8Array(bytes);
	crypto.getRandomValues(array);
	return Array.from(array)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export const GET: RequestHandler = async (event) => {
	if (!requireAdmin(event)) return apiError('Unauthorized', 401);

	const cpDb = event.locals.cpDb;
	const { url } = event;

	const tenantIdFilter = url.searchParams.get('tenant_id');
	const limit = parseIntParam(url.searchParams.get('limit'), 50);
	const offset = parseIntParam(url.searchParams.get('offset'), 0);

	let query = cpDb
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
		.$dynamic();

	if (tenantIdFilter) {
		query = query.where(eq(apiClients.tenantId, tenantIdFilter));
	}

	const rows = await query.limit(limit).offset(offset);

	return apiSuccess({ clients: rows });
};

export const POST: RequestHandler = async (event) => {
	if (!requireAdmin(event)) return apiError('Unauthorized', 401);

	const cpDb = event.locals.cpDb;

	let body: {
		tenantId?: string;
		name?: string;
		partnerId?: string;
		scope?: string;
		tier?: string;
		allowedRids?: number[];
	};

	try {
		body = await event.request.json();
	} catch {
		return apiError('Invalid JSON body', 400);
	}

	if (!body.tenantId || typeof body.tenantId !== 'string') {
		return apiError('tenantId is required', 400);
	}
	if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
		return apiError('name is required', 400);
	}

	const validTiers = ['copper', 'gold', 'platinum'] as const;
	const tier = body.tier ?? 'copper';
	if (!validTiers.includes(tier as (typeof validTiers)[number])) {
		return apiError(`tier must be one of: ${validTiers.join(', ')}`, 400);
	}

	if (body.allowedRids !== undefined) {
		if (!Array.isArray(body.allowedRids) || !body.allowedRids.every((r) => typeof r === 'number')) {
			return apiError('allowedRids must be an array of numbers', 400);
		}
	}

	// Verify tenant exists
	const tenantRows = await cpDb
		.select({ id: tenants.id })
		.from(tenants)
		.where(eq(tenants.id, body.tenantId))
		.limit(1);

	if (tenantRows.length === 0) {
		return apiError('Tenant not found', 404);
	}

	const clientId = `fr_${generateHex(16)}`;
	const clientSecret = `frs_${generateHex(32)}`;
	const now = new Date().toISOString();

	const [created] = await cpDb
		.insert(apiClients)
		.values({
			tenantId: body.tenantId,
			clientId,
			clientSecret,
			name: body.name.trim(),
			partnerId: body.partnerId ?? null,
			scope: body.scope ?? 'DEFAULT',
			tier: tier as 'copper' | 'gold' | 'platinum',
			allowedRids: body.allowedRids ?? null,
			active: true,
			createdAt: now,
			updatedAt: now
		})
		.returning();

	// Return with the secret visible — this is the only time it's shown
	return apiSuccess(
		{
			...created,
			clientSecret
		},
		201
	);
};
