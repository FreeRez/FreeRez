CREATE TABLE `platform_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`sensitive` integer DEFAULT false,
	`updated_at` text
);--> statement-breakpoint
CREATE UNIQUE INDEX `platform_settings_key_unique` ON `platform_settings` (`key`);
