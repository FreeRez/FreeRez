ALTER TABLE partner_integrations ADD COLUMN metadata TEXT;--> statement-breakpoint
ALTER TABLE reviews ADD COLUMN source TEXT DEFAULT 'internal';--> statement-breakpoint
ALTER TABLE review_replies ADD COLUMN external_reply_state TEXT;
