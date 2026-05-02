import { createDb } from '$db';
import { createControlPlaneDb } from '$lib/server/control-plane';
import type { Database } from '$db';
import type { ControlPlaneDatabase } from '$lib/server/control-plane';
import type { DatabaseAdapter, CloudflareEnv } from './types';

export class CloudflareAdapter implements DatabaseAdapter {
	private env: CloudflareEnv;
	private cpDb: ControlPlaneDatabase | null = null;
	private defaultDb: Database | null = null;
	private tenantDbs = new Map<string, Database>();

	constructor(env: CloudflareEnv) {
		this.env = env;
	}

	getControlPlaneDb(): ControlPlaneDatabase {
		if (!this.cpDb) {
			this.cpDb = createControlPlaneDb(this.env.CONTROL_PLANE_DB);
		}
		return this.cpDb;
	}

	getDefaultDb(): Database {
		if (!this.defaultDb) {
			this.defaultDb = createDb(this.env.DB);
		}
		return this.defaultDb;
	}

	getTenantDb(d1DatabaseId: string): Database {
		if (d1DatabaseId === 'default') {
			return this.getDefaultDb();
		}

		const cached = this.tenantDbs.get(d1DatabaseId);
		if (cached) return cached;

		if (this.env.TENANT_DBS && d1DatabaseId in this.env.TENANT_DBS) {
			const db = createDb(this.env.TENANT_DBS[d1DatabaseId]);
			this.tenantDbs.set(d1DatabaseId, db);
			return db;
		}

		return this.getDefaultDb();
	}
}
