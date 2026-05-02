import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

const timestamp = (name: string) =>
	text(name).$defaultFn(() => new Date().toISOString());

const id = () =>
	text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID());

// ─── Tenants ─────────────────────────────────────────────────────────────────

export const tenants = sqliteTable('tenants', {
	id: id(),
	name: text('name').notNull(),
	slug: text('slug').notNull().unique(),
	email: text('email').notNull(),
	plan: text('plan', { enum: ['free', 'starter', 'professional', 'enterprise'] })
		.notNull()
		.default('free'),
	status: text('status', { enum: ['active', 'suspended', 'cancelled'] })
		.notNull()
		.default('active'),
	maxRestaurants: integer('max_restaurants').notNull().default(1),
	createdAt: timestamp('created_at'),
	updatedAt: timestamp('updated_at')
});

// ─── Tenant Databases ────────────────────────────────────────────────────────
// Maps each tenant to their D1 database. For Cloudflare hosted, this is a real
// D1 database ID. For self-hosted, this maps to a local SQLite file or binding.

export const tenantDatabases = sqliteTable('tenant_databases', {
	id: id(),
	tenantId: text('tenant_id')
		.notNull()
		.references(() => tenants.id, { onDelete: 'cascade' }),
	d1DatabaseId: text('d1_database_id').notNull(),
	d1DatabaseName: text('d1_database_name').notNull(),
	region: text('region').default('auto'),
	status: text('status', { enum: ['provisioning', 'ready', 'migrating', 'error'] })
		.notNull()
		.default('provisioning'),
	schemaVersion: integer('schema_version').notNull().default(0),
	createdAt: timestamp('created_at'),
	updatedAt: timestamp('updated_at')
});

// ─── Tenant Restaurant Registry ──────────────────────────────────────────────
// Tracks which restaurants exist in which tenant DB. Enables rid → tenant
// resolution without querying every tenant DB.

export const tenantRestaurants = sqliteTable(
	'tenant_restaurants',
	{
		id: id(),
		tenantId: text('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		rid: integer('rid').notNull(),
		restaurantName: text('restaurant_name').notNull(),
		active: integer('active', { mode: 'boolean' }).default(true),
		createdAt: timestamp('created_at')
	},
	(t) => [
		uniqueIndex('idx_tenant_restaurants_rid').on(t.rid),
		index('idx_tenant_restaurants_tenant').on(t.tenantId)
	]
);

// ─── API Clients (moved from tenant DB) ──────────────────────────────────────
// Lives in control plane so token validation happens before tenant DB resolution.

export const apiClients = sqliteTable(
	'api_clients',
	{
		id: id(),
		tenantId: text('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		clientId: text('client_id').notNull().unique(),
		clientSecret: text('client_secret').notNull(),
		name: text('name').notNull(),
		partnerId: text('partner_id'),
		scope: text('scope').notNull().default('DEFAULT'),
		tier: text('tier', { enum: ['copper', 'gold', 'platinum'] })
			.notNull()
			.default('copper'),
		allowedRids: text('allowed_rids', { mode: 'json' }).$type<number[] | null>(),
		active: integer('active', { mode: 'boolean' }).default(true),
		createdAt: timestamp('created_at'),
		updatedAt: timestamp('updated_at')
	},
	(t) => [index('idx_api_clients_tenant').on(t.tenantId)]
);

export const apiTokens = sqliteTable(
	'api_tokens',
	{
		id: id(),
		clientId: text('client_id')
			.notNull()
			.references(() => apiClients.id, { onDelete: 'cascade' }),
		tenantId: text('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		accessToken: text('access_token').notNull().unique(),
		scope: text('scope').notNull().default('DEFAULT'),
		expiresAt: text('expires_at').notNull(),
		createdAt: timestamp('created_at')
	},
	(t) => [index('idx_api_tokens_access').on(t.accessToken)]
);

// ─── Tenant Members ──────────────────────────────────────────────────────────
// Maps platform users to tenants. A user can belong to multiple tenants
// (e.g., a consultant managing several restaurant groups).

export const tenantMembers = sqliteTable(
	'tenant_members',
	{
		id: id(),
		tenantId: text('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		email: text('email').notNull(),
		role: text('role', { enum: ['owner', 'admin', 'member'] })
			.notNull()
			.default('member'),
		inviteStatus: text('invite_status', { enum: ['pending', 'accepted'] })
			.notNull()
			.default('pending'),
		createdAt: timestamp('created_at')
	},
	(t) => [uniqueIndex('idx_tenant_members_unique').on(t.tenantId, t.email)]
);

// ─── Idempotency Keys ────────────────────────────────────────────────────────

export const idempotencyKeys = sqliteTable(
	'idempotency_keys',
	{
		id: id(),
		clientId: text('client_id').notNull(),
		requestId: text('request_id').notNull(),
		method: text('method').notNull(),
		path: text('path').notNull(),
		statusCode: integer('status_code').notNull(),
		responseBody: text('response_body').notNull(),
		createdAt: text('created_at').notNull()
	},
	(t) => [
		uniqueIndex('idx_idempotency_client_request').on(t.clientId, t.requestId),
		index('idx_idempotency_created').on(t.createdAt)
	]
);

// ─── Platform Settings ──────────────────────────────────────────────────────
// Stores platform-level configuration (OAuth app credentials, feature flags)
// that can be managed through the admin UI without redeploying.

export const platformSettings = sqliteTable(
	'platform_settings',
	{
		id: id(),
		key: text('key').notNull().unique(),
		value: text('value').notNull(),
		sensitive: integer('sensitive', { mode: 'boolean' }).default(false),
		updatedAt: timestamp('updated_at')
	}
);

// ─── Audit Log ───────────────────────────────────────────────────────────────

export const auditLog = sqliteTable(
	'audit_log',
	{
		id: id(),
		tenantId: text('tenant_id').references(() => tenants.id),
		actorType: text('actor_type', { enum: ['user', 'api_client', 'system'] }).notNull(),
		actorId: text('actor_id').notNull(),
		action: text('action').notNull(),
		resourceType: text('resource_type').notNull(),
		resourceId: text('resource_id'),
		metadata: text('metadata', { mode: 'json' }),
		createdAt: timestamp('created_at')
	},
	(t) => [
		index('idx_audit_tenant').on(t.tenantId),
		index('idx_audit_created').on(t.createdAt)
	]
);
