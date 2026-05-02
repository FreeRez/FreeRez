import type { Database } from '$db';
import type { ControlPlaneDatabase } from '$lib/server/control-plane';

export interface DatabaseAdapter {
	getControlPlaneDb(): ControlPlaneDatabase;
	getTenantDb(d1DatabaseId: string): Database;
	getDefaultDb(): Database;
}

export type AdapterConfig =
	| { type: 'cloudflare'; env: CloudflareEnv }
	| { type: 'sqlite'; dataDir: string; controlPlanePath?: string };

export type CloudflareEnv = {
	DB: D1Database;
	CONTROL_PLANE_DB: D1Database;
	TENANT_DBS?: Record<string, D1Database>;
};
