CREATE TABLE `idempotency_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`request_id` text NOT NULL,
	`method` text NOT NULL,
	`path` text NOT NULL,
	`status_code` integer NOT NULL,
	`response_body` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_idempotency_client_request` ON `idempotency_keys` (`client_id`,`request_id`);--> statement-breakpoint
CREATE INDEX `idx_idempotency_created` ON `idempotency_keys` (`created_at`);