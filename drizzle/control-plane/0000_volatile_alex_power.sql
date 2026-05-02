CREATE TABLE `api_clients` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`client_id` text NOT NULL,
	`client_secret` text NOT NULL,
	`name` text NOT NULL,
	`partner_id` text,
	`scope` text DEFAULT 'DEFAULT' NOT NULL,
	`tier` text DEFAULT 'copper' NOT NULL,
	`allowed_rids` text,
	`active` integer DEFAULT true,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_clients_client_id_unique` ON `api_clients` (`client_id`);--> statement-breakpoint
CREATE INDEX `idx_api_clients_tenant` ON `api_clients` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `api_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`access_token` text NOT NULL,
	`scope` text DEFAULT 'DEFAULT' NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text,
	FOREIGN KEY (`client_id`) REFERENCES `api_clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_tokens_access_token_unique` ON `api_tokens` (`access_token`);--> statement-breakpoint
CREATE INDEX `idx_api_tokens_access` ON `api_tokens` (`access_token`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text,
	`actor_type` text NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text,
	`metadata` text,
	`created_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_audit_tenant` ON `audit_log` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_created` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `tenant_databases` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`d1_database_id` text NOT NULL,
	`d1_database_name` text NOT NULL,
	`region` text DEFAULT 'auto',
	`status` text DEFAULT 'provisioning' NOT NULL,
	`schema_version` integer DEFAULT 0 NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tenant_members` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`invite_status` text DEFAULT 'pending' NOT NULL,
	`created_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tenant_members_unique` ON `tenant_members` (`tenant_id`,`email`);--> statement-breakpoint
CREATE TABLE `tenant_restaurants` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`rid` integer NOT NULL,
	`restaurant_name` text NOT NULL,
	`active` integer DEFAULT true,
	`created_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tenant_restaurants_rid` ON `tenant_restaurants` (`rid`);--> statement-breakpoint
CREATE INDEX `idx_tenant_restaurants_tenant` ON `tenant_restaurants` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`email` text NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`max_restaurants` integer DEFAULT 1 NOT NULL,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_slug_unique` ON `tenants` (`slug`);