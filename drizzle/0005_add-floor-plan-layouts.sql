CREATE TABLE `floor_plan_layouts` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL REFERENCES `restaurants`(`id`) ON DELETE CASCADE,
	`name` text NOT NULL,
	`layout_data` text,
	`is_default` integer DEFAULT 0,
	`created_at` text,
	`updated_at` text
);--> statement-breakpoint
CREATE INDEX `idx_floor_plan_layouts_restaurant` ON `floor_plan_layouts`(`restaurant_id`);--> statement-breakpoint
ALTER TABLE `restaurants` ADD `active_layout_id` text REFERENCES `floor_plan_layouts`(`id`) ON DELETE SET NULL;
