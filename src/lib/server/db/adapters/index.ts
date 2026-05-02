export type { DatabaseAdapter, AdapterConfig, CloudflareEnv } from './types';
export { CloudflareAdapter } from './cloudflare';
export { SqliteAdapter } from './sqlite';

import type { AdapterConfig, DatabaseAdapter } from './types';
import { CloudflareAdapter } from './cloudflare';
import { SqliteAdapter } from './sqlite';

export function createAdapter(config: AdapterConfig): DatabaseAdapter {
	switch (config.type) {
		case 'cloudflare':
			return new CloudflareAdapter(config.env);
		case 'sqlite':
			return new SqliteAdapter(config.dataDir, config.controlPlanePath);
	}
}
