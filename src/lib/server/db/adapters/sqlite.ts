import type { Database } from '$db';
import type { ControlPlaneDatabase } from '$lib/server/control-plane';
import type { DatabaseAdapter } from './types';

/**
 * SQLite adapter for self-hosted deployments (Docker/VPS).
 *
 * Uses libsql or better-sqlite3 as the driver. Each tenant gets a separate
 * SQLite file on disk:
 *
 *   /data/control-plane.sqlite    — control plane
 *   /data/tenants/default.sqlite  — default tenant DB
 *   /data/tenants/{id}.sqlite     — per-tenant DBs
 *
 * In the Docker edition, this adapter is instantiated at startup.
 * The Drizzle schema and all query logic is identical to Cloudflare D1 —
 * only the connection layer differs.
 *
 * Implementation note: This file defines the interface and will use
 * dynamic imports at runtime so that libsql/better-sqlite3 are only
 * loaded in Node.js environments, not bundled for Cloudflare Workers.
 */
export class SqliteAdapter implements DatabaseAdapter {
	private dataDir: string;
	private controlPlanePath: string;
	private connections = new Map<string, Database>();
	private cpConnection: ControlPlaneDatabase | null = null;

	constructor(dataDir: string, controlPlanePath?: string) {
		this.dataDir = dataDir;
		this.controlPlanePath = controlPlanePath ?? `${dataDir}/control-plane.sqlite`;
	}

	getControlPlaneDb(): ControlPlaneDatabase {
		if (!this.cpConnection) {
			this.cpConnection = this.openControlPlane(this.controlPlanePath);
		}
		return this.cpConnection;
	}

	getDefaultDb(): Database {
		return this.getTenantDb('default');
	}

	getTenantDb(d1DatabaseId: string): Database {
		const cached = this.connections.get(d1DatabaseId);
		if (cached) return cached;

		const dbPath = d1DatabaseId === 'default'
			? `${this.dataDir}/tenants/default.sqlite`
			: `${this.dataDir}/tenants/${d1DatabaseId}.sqlite`;

		const db = this.openTenantDb(dbPath);
		this.connections.set(d1DatabaseId, db);
		return db;
	}

	private openTenantDb(dbPath: string): Database {
		// Dynamic import to avoid bundling for Cloudflare
		// At runtime in Node.js/Docker, this resolves to the actual driver
		//
		// Usage with better-sqlite3:
		//   import Database from 'better-sqlite3';
		//   import { drizzle } from 'drizzle-orm/better-sqlite3';
		//   const sqlite = new Database(dbPath);
		//   return drizzle(sqlite, { schema });
		//
		// Usage with libsql:
		//   import { createClient } from '@libsql/client';
		//   import { drizzle } from 'drizzle-orm/libsql';
		//   const client = createClient({ url: `file:${dbPath}` });
		//   return drizzle(client, { schema });
		//
		// For now, throw with instructions since this runs in Cloudflare:
		throw new Error(
			`SqliteAdapter: Cannot open ${dbPath} in Cloudflare Workers. ` +
			`This adapter is for self-hosted Docker/Node.js deployments. ` +
			`Install better-sqlite3 or @libsql/client and uncomment the driver code.`
		);
	}

	private openControlPlane(dbPath: string): ControlPlaneDatabase {
		// Same pattern as openTenantDb — uses the control plane schema instead.
		// See openTenantDb() comments for driver usage.
		throw new Error(
			`SqliteAdapter: Cannot open ${dbPath} in Cloudflare Workers. ` +
			`This adapter is for self-hosted Docker/Node.js deployments.`
		);
	}
}
