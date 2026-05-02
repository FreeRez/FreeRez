CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`access_token_expires_at` text,
	`refresh_token_expires_at` text,
	`scope` text,
	`id_token` text,
	`password` text,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `booking_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`policy_type` text DEFAULT 'General' NOT NULL,
	`message` text NOT NULL,
	`language_code` text DEFAULT 'en',
	`language_region` text DEFAULT 'US',
	`active` integer DEFAULT true,
	`created_at` text,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `cancellation_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`policy_type` text DEFAULT 'None' NOT NULL,
	`deposit_amount` integer,
	`deposit_currency` text DEFAULT 'USD',
	`deposit_denominator` integer DEFAULT 100,
	`deposit_type` text,
	`cutoff_type` text,
	`cutoff_value` integer,
	`active` integer DEFAULT true,
	`created_at` text,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `dining_areas` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`area_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`environment` text,
	`attributes` text,
	`active` integer DEFAULT true,
	`created_at` text,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `experience_addon_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`experience_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`max_per_reservation` integer DEFAULT 0,
	FOREIGN KEY (`experience_id`) REFERENCES `experiences`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `experience_addons` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`addon_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`max_per_reservation` integer DEFAULT 20,
	`price_min_unit_amount` integer DEFAULT 0,
	`price_multiplier` integer DEFAULT 100,
	`currency_code` text DEFAULT 'USD',
	`service_charges` text,
	FOREIGN KEY (`group_id`) REFERENCES `experience_addon_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `experience_prices` (
	`id` text PRIMARY KEY NOT NULL,
	`experience_id` text NOT NULL,
	`price_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`price` integer NOT NULL,
	`price_all_inclusive` integer DEFAULT false,
	FOREIGN KEY (`experience_id`) REFERENCES `experiences`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `experience_service_charges` (
	`id` text PRIMARY KEY NOT NULL,
	`experience_id` text NOT NULL,
	`service_charge_id` integer NOT NULL,
	`label` text NOT NULL,
	`numerator` integer NOT NULL,
	`denominator` integer NOT NULL,
	`mandatory` integer DEFAULT true,
	`taxable` integer DEFAULT true,
	`description` text,
	FOREIGN KEY (`experience_id`) REFERENCES `experiences`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `experience_taxes` (
	`id` text PRIMARY KEY NOT NULL,
	`experience_id` text NOT NULL,
	`tax_id` integer NOT NULL,
	`tax_percent` real NOT NULL,
	`label` text,
	FOREIGN KEY (`experience_id`) REFERENCES `experiences`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `experiences` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`experience_id` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`currency` text DEFAULT 'USD',
	`currency_denominator` integer DEFAULT 100,
	`bookable` integer DEFAULT true,
	`prepaid` integer DEFAULT false,
	`price` integer DEFAULT 0,
	`has_mandatory_tip` integer DEFAULT false,
	`is_tip_taxable` integer DEFAULT false,
	`active` integer DEFAULT true,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `guest_insights` (
	`id` text PRIMARY KEY NOT NULL,
	`guest_id` text NOT NULL,
	`label` text NOT NULL,
	`value` text NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`guest_id`) REFERENCES `guests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `guest_loyalties` (
	`id` text PRIMARY KEY NOT NULL,
	`guest_id` text NOT NULL,
	`program_name` text NOT NULL,
	`loyalty_tier` text,
	`points_balance` text,
	`account_id` text,
	`flex_fields` text,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`guest_id`) REFERENCES `guests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `guest_properties` (
	`id` text PRIMARY KEY NOT NULL,
	`guest_id` text NOT NULL,
	`property_name` text NOT NULL,
	`res_status_code` text,
	`reservation_id` text,
	`res_arrive_date` text,
	`res_depart_date` text,
	`room_number` text,
	`rate_code` text,
	`flex_fields` text,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`guest_id`) REFERENCES `guests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `guest_tag_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`guest_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`created_at` text,
	FOREIGN KEY (`guest_id`) REFERENCES `guests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tag_assignment_guest_tag` ON `guest_tag_assignments` (`guest_id`,`tag_id`);--> statement-breakpoint
CREATE TABLE `guest_tag_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`display_name` text NOT NULL,
	`category` text NOT NULL,
	`created_at` text,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tag_def_restaurant_tag` ON `guest_tag_definitions` (`restaurant_id`,`tag_id`);--> statement-breakpoint
CREATE TABLE `guests` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`rid` integer NOT NULL,
	`sequence_id` integer NOT NULL,
	`gpid` text,
	`first_name` text,
	`last_name` text,
	`email` text,
	`email_optin` integer DEFAULT false,
	`phone` text,
	`phone_type` text,
	`phone_numbers` text,
	`tags` text,
	`birth_date` text,
	`anniversary_date` text,
	`company_name` text,
	`notes` text,
	`notes_special_relationship` text,
	`notes_food_and_drink` text,
	`notes_seating` text,
	`address` text,
	`forgotten` integer DEFAULT false,
	`archived` integer DEFAULT false,
	`is_hidden` integer DEFAULT false,
	`mail_opted_in` integer DEFAULT false,
	`marketing_opted_out` integer DEFAULT false,
	`sms_opt_in` integer,
	`primary_guest` text,
	`date_first_visit` text,
	`date_last_visit` text,
	`date_first_visit_utc` text,
	`date_last_visit_utc` text,
	`date_email_opt_in_opt_out` text,
	`date_email_opt_in_opt_out_utc` text,
	`photo_url` text,
	`photo_status` text,
	`created_at` text,
	`updated_at` text,
	`created_at_utc` text,
	`updated_at_utc` text,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_guests_restaurant` ON `guests` (`restaurant_id`);--> statement-breakpoint
CREATE INDEX `idx_guests_email` ON `guests` (`email`);--> statement-breakpoint
CREATE INDEX `idx_guests_rid` ON `guests` (`rid`);--> statement-breakpoint
CREATE TABLE `menu_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`menu_id` text NOT NULL,
	`group_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`ordinal` integer DEFAULT 0,
	FOREIGN KEY (`menu_id`) REFERENCES `menus`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `menu_items` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`item_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`ordinal` integer DEFAULT 0,
	`price_amount` integer,
	`price_currency` text DEFAULT 'USD',
	`price_denominator` integer DEFAULT 100,
	`tags` text,
	`modifier_groups` text,
	FOREIGN KEY (`group_id`) REFERENCES `menu_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `menus` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`rid` integer NOT NULL,
	`menu_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`currency` text DEFAULT 'USD',
	`ordinal` integer DEFAULT 0,
	`updated_at` text,
	`created_at` text,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_menus_restaurant` ON `menus` (`restaurant_id`);--> statement-breakpoint
CREATE TABLE `partner_integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`partner_id` text NOT NULL,
	`partner_identifier` text,
	`access_token` text,
	`refresh_token` text,
	`token_expires_at` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `pos_restaurants` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`rid` integer NOT NULL,
	`restaurant_name` text NOT NULL,
	`source_location_id` text,
	`pos_type` text,
	`status` text DEFAULT 'enabled' NOT NULL,
	`source_location_status` text DEFAULT 'online' NOT NULL,
	`datetime_of_first_check` text,
	`datetime_of_last_check` text,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `pos_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`rid` integer NOT NULL,
	`ticket_id` text NOT NULL,
	`ticket_number` text,
	`opened_at` text,
	`closed_at` text,
	`updated_at` text,
	`party_size` integer,
	`order_type` text,
	`order_items` text,
	`payments` text,
	`subtotal` integer,
	`tax` integer,
	`tip` integer,
	`total` integer,
	`currency_code` text DEFAULT 'USD',
	`currency_denominator` integer DEFAULT 100,
	`created_at` text,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_pos_tickets_restaurant` ON `pos_tickets` (`restaurant_id`);--> statement-breakpoint
CREATE INDEX `idx_pos_tickets_ticket_id` ON `pos_tickets` (`ticket_id`);--> statement-breakpoint
CREATE TABLE `private_dining_leads` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`rid` integer NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text NOT NULL,
	`phone_number` text,
	`event_date` text,
	`event_time` text,
	`party_size` integer,
	`event_type` text,
	`flexible_date` integer DEFAULT false,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`rid` integer NOT NULL,
	`guest_id` text,
	`confirmation_id` integer NOT NULL,
	`sequence_id` integer NOT NULL,
	`state` text DEFAULT 'Pending' NOT NULL,
	`table_number` text,
	`party_size` integer NOT NULL,
	`scheduled_time` text NOT NULL,
	`scheduled_time_utc` text,
	`reservation_attribute` text DEFAULT 'default',
	`origin` text DEFAULT 'Web' NOT NULL,
	`guest_request` text,
	`venue_notes` text,
	`opentable_notes` text,
	`table_category` text,
	`dining_area_id` integer,
	`environment` text,
	`server` text,
	`visit_tags` text,
	`seated_time` text,
	`seated_time_utc` text,
	`done_time` text,
	`done_time_utc` text,
	`arrived_time` text,
	`arrived_time_utc` text,
	`cancellation_date` text,
	`cancellation_date_utc` text,
	`quoted_wait_time` integer DEFAULT 0,
	`online_source` text,
	`discovery_type` text,
	`partner` text,
	`campaign_details` text,
	`credit_card_status` text,
	`rest_ref_campaign_name` text,
	`rest_ref_id` text,
	`rest_ref_source` text,
	`currency_code` text,
	`currency_denominator` integer DEFAULT 100,
	`sms_notifications_opt_in` integer,
	`marketing_opted_out` integer DEFAULT false,
	`restaurant_email_marketing_opt_in` integer DEFAULT false,
	`manage_reservation_url` text,
	`experience_details` text,
	`deposit_details` text,
	`referrer` text,
	`pos_data` text,
	`added_to_waitlist` text,
	`added_to_waitlist_utc` text,
	`created_at` text,
	`updated_at` text,
	`created_at_utc` text,
	`updated_at_utc` text,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`guest_id`) REFERENCES `guests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_reservations_restaurant` ON `reservations` (`restaurant_id`);--> statement-breakpoint
CREATE INDEX `idx_reservations_rid` ON `reservations` (`rid`);--> statement-breakpoint
CREATE INDEX `idx_reservations_guest` ON `reservations` (`guest_id`);--> statement-breakpoint
CREATE INDEX `idx_reservations_scheduled` ON `reservations` (`scheduled_time`);--> statement-breakpoint
CREATE INDEX `idx_reservations_state` ON `reservations` (`state`);--> statement-breakpoint
CREATE INDEX `idx_reservations_confirmation` ON `reservations` (`confirmation_id`);--> statement-breakpoint
CREATE TABLE `restaurant_staff` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`active` integer DEFAULT true,
	`created_at` text,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_staff_restaurant_user` ON `restaurant_staff` (`restaurant_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `restaurants` (
	`id` text PRIMARY KEY NOT NULL,
	`rid` integer NOT NULL,
	`owner_id` text,
	`name` text NOT NULL,
	`description` text,
	`primary_cuisine` text,
	`phone` text,
	`currency` text DEFAULT 'USD',
	`locale` text DEFAULT 'en-US',
	`website` text,
	`timezone` text DEFAULT 'America/New_York',
	`price_band_id` integer,
	`dining_style` text,
	`dress_code` text,
	`executive_chef` text,
	`cross_street` text,
	`private_event_details` text,
	`catering_details` text,
	`address` text,
	`address2` text,
	`city` text,
	`state` text,
	`country` text DEFAULT 'US',
	`postal_code` text,
	`latitude` real,
	`longitude` real,
	`metro_name` text,
	`neighborhood_name` text,
	`profile_photo_url` text,
	`reservation_url` text,
	`profile_url` text,
	`tags` text,
	`opening_times` text,
	`active` integer DEFAULT true,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `restaurants_rid_unique` ON `restaurants` (`rid`);--> statement-breakpoint
CREATE INDEX `idx_restaurants_rid` ON `restaurants` (`rid`);--> statement-breakpoint
CREATE INDEX `idx_restaurants_city` ON `restaurants` (`city`);--> statement-breakpoint
CREATE INDEX `idx_restaurants_country` ON `restaurants` (`country`);--> statement-breakpoint
CREATE TABLE `review_replies` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`message` text NOT NULL,
	`from` text DEFAULT 'Restaurant',
	`name` text,
	`is_public` integer DEFAULT true,
	`replying_to_reply_id` text,
	`reply_to_email` text,
	`created_at` text,
	FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`rid` integer NOT NULL,
	`review_id` text NOT NULL,
	`reservation_id` integer,
	`gp_id` text,
	`country_code` text,
	`customer_nickname` text,
	`locale` text DEFAULT 'en-US',
	`language` text DEFAULT 'en',
	`metro_id` integer,
	`moderation_state` integer,
	`simplified_moderation_state` text,
	`rating_overall` integer,
	`rating_food` integer,
	`rating_service` integer,
	`rating_ambience` integer,
	`rating_value` integer,
	`rating_noise` integer,
	`recommended` integer,
	`review_text` text,
	`review_title` text,
	`review_type` integer DEFAULT 0,
	`dined_date_time` text,
	`submission_date_time_utc` text,
	`last_modified_date_time_utc` text,
	`categories` text,
	`photos` text,
	`diner_initials` text,
	`diner_metro_id` integer,
	`diner_is_vip` integer DEFAULT false,
	`helpfulness_up` integer DEFAULT 0,
	`helpfulness_down` integer DEFAULT 0,
	`featured` integer DEFAULT false,
	`is_draft` integer DEFAULT false,
	`created_at` text,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_review_id_unique` ON `reviews` (`review_id`);--> statement-breakpoint
CREATE INDEX `idx_reviews_restaurant` ON `reviews` (`restaurant_id`);--> statement-breakpoint
CREATE INDEX `idx_reviews_rid` ON `reviews` (`rid`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE TABLE `shifts` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`name` text NOT NULL,
	`day_of_week` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`slot_interval_minutes` integer DEFAULT 15,
	`max_covers_per_slot` integer,
	`active` integer DEFAULT true,
	`created_at` text,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `slot_locks` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`reservation_token` text NOT NULL,
	`party_size` integer NOT NULL,
	`date_time` text NOT NULL,
	`reservation_attribute` text DEFAULT 'default',
	`dining_area_id` integer,
	`environment` text,
	`experience_data` text,
	`expires_at` text NOT NULL,
	`created_at` text,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `slot_locks_reservation_token_unique` ON `slot_locks` (`reservation_token`);--> statement-breakpoint
CREATE TABLE `tables` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`dining_area_id` text,
	`table_number` text NOT NULL,
	`min_covers` integer DEFAULT 1,
	`max_covers` integer NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`position_x` real,
	`position_y` real,
	`shape` text DEFAULT 'square',
	`active` integer DEFAULT true,
	`created_at` text,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`dining_area_id`) REFERENCES `dining_areas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_tables_restaurant` ON `tables` (`restaurant_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false,
	`image` text,
	`role` text DEFAULT 'owner' NOT NULL,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `webhook_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`subscription_id` text NOT NULL,
	`event` text NOT NULL,
	`payload` text,
	`status_code` integer,
	`response_body` text,
	`attempts` integer DEFAULT 0,
	`delivered_at` text,
	`created_at` text,
	FOREIGN KEY (`subscription_id`) REFERENCES `webhook_subscriptions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_webhook_deliveries_subscription` ON `webhook_deliveries` (`subscription_id`);--> statement-breakpoint
CREATE TABLE `webhook_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`partner_id` text,
	`url` text NOT NULL,
	`events` text NOT NULL,
	`secret` text,
	`active` integer DEFAULT true,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
