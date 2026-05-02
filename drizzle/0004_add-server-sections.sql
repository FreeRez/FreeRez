CREATE TABLE `server_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL REFERENCES `restaurants`(`id`) ON DELETE CASCADE,
	`staff_id` text NOT NULL REFERENCES `restaurant_staff`(`id`) ON DELETE CASCADE,
	`shift_id` text REFERENCES `shifts`(`id`) ON DELETE SET NULL,
	`date` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`active` integer DEFAULT 1,
	`created_at` text,
	`updated_at` text
);--> statement-breakpoint
CREATE INDEX `idx_server_sections_restaurant_date` ON `server_sections`(`restaurant_id`, `date`);--> statement-breakpoint
CREATE INDEX `idx_server_sections_staff` ON `server_sections`(`staff_id`);--> statement-breakpoint
CREATE TABLE `server_section_tables` (
	`id` text PRIMARY KEY NOT NULL,
	`section_id` text NOT NULL REFERENCES `server_sections`(`id`) ON DELETE CASCADE,
	`table_id` text NOT NULL REFERENCES `tables`(`id`) ON DELETE CASCADE
);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_section_table_unique` ON `server_section_tables`(`section_id`, `table_id`);--> statement-breakpoint
CREATE INDEX `idx_section_tables_section` ON `server_section_tables`(`section_id`);
