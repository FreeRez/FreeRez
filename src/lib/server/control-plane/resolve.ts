import { eq, and } from 'drizzle-orm';
import type { ControlPlaneDatabase } from './index';
import { apiTokens, apiClients, tenants, tenantDatabases } from './schema';

export type ResolvedTenant = {
	tenantId: string;
	tenantSlug: string;
	tenantPlan: string;
	clientId: string;
	partnerId: string | null;
	tier: string;
	scope: string;
	allowedRids: number[] | null;
	d1DatabaseId: string;
};

export async function resolveTokenToTenant(
	cpDb: ControlPlaneDatabase,
	bearerToken: string
): Promise<ResolvedTenant | null> {
	const result = await cpDb
		.select({
			tenantId: tenants.id,
			tenantSlug: tenants.slug,
			tenantPlan: tenants.plan,
			tenantStatus: tenants.status,
			clientId: apiClients.id,
			partnerId: apiClients.partnerId,
			tier: apiClients.tier,
			scope: apiClients.scope,
			allowedRids: apiClients.allowedRids,
			tokenExpiresAt: apiTokens.expiresAt,
			dbId: tenantDatabases.d1DatabaseId,
			dbStatus: tenantDatabases.status
		})
		.from(apiTokens)
		.innerJoin(apiClients, eq(apiTokens.clientId, apiClients.id))
		.innerJoin(tenants, eq(apiTokens.tenantId, tenants.id))
		.innerJoin(tenantDatabases, eq(tenantDatabases.tenantId, tenants.id))
		.where(
			and(
				eq(apiTokens.accessToken, bearerToken),
				eq(apiClients.active, true),
				eq(tenants.status, 'active'),
				eq(tenantDatabases.status, 'ready')
			)
		)
		.limit(1);

	if (result.length === 0) return null;

	const row = result[0];
	if (new Date(row.tokenExpiresAt) < new Date()) return null;

	return {
		tenantId: row.tenantId,
		tenantSlug: row.tenantSlug,
		tenantPlan: row.tenantPlan,
		clientId: row.clientId,
		partnerId: row.partnerId,
		tier: row.tier,
		scope: row.scope,
		allowedRids: row.allowedRids as number[] | null,
		d1DatabaseId: row.dbId
	};
}
