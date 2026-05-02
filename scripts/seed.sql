-- Seed data for FreeRez testing
-- API Client for OAuth testing
INSERT INTO api_clients (id, client_id, client_secret, name, partner_id, scope, tier, active, created_at, updated_at)
VALUES (
  'client-001',
  'freerez_test_client',
  'freerez_test_secret',
  'Test Partner',
  'partner-001',
  'DEFAULT',
  'platinum',
  1,
  '2025-04-28T00:00:00.000Z',
  '2025-04-28T00:00:00.000Z'
);

-- Users
INSERT INTO users (id, name, email, email_verified, role, created_at, updated_at)
VALUES (
  'user-001',
  'Test Owner',
  'owner@freerez.test',
  1,
  'owner',
  '2025-04-28T00:00:00.000Z',
  '2025-04-28T00:00:00.000Z'
);

-- Restaurant
INSERT INTO restaurants (id, rid, owner_id, name, description, primary_cuisine, phone, currency, locale, website, timezone, price_band_id, dining_style, dress_code, executive_chef, cross_street, private_event_details, catering_details, address, address2, city, state, country, postal_code, latitude, longitude, metro_name, neighborhood_name, profile_photo_url, tags, opening_times, active, created_at, updated_at)
VALUES (
  'rest-001',
  1038007,
  'user-001',
  'Vogel''s Bistro',
  'A charming bistro serving modern American cuisine with farm-to-table ingredients.',
  'American',
  '4155551234',
  'USD',
  'en-US',
  'https://vogelsbistro.com',
  'America/Chicago',
  2,
  'Casual Dining',
  'Smart Casual',
  'Chef Matt Vogel',
  'Oak Street',
  '300 seat event space available',
  'Offsite catering available',
  '123 Main Street',
  'Suite 100',
  'Chicago',
  'IL',
  'US',
  '60601',
  41.8781,
  -87.6298,
  'Chicago',
  'River North',
  'https://example.com/photo.jpg',
  '["Cocktails","Fireplace","Outdoor Dining"]',
  '{"MONDAY":[{"start":"11:00","end":"22:00"}],"TUESDAY":[{"start":"11:00","end":"22:00"}],"WEDNESDAY":[{"start":"11:00","end":"22:00"}],"THURSDAY":[{"start":"11:00","end":"23:00"}],"FRIDAY":[{"start":"11:00","end":"23:00"}],"SATURDAY":[{"start":"10:00","end":"23:00"}],"SUNDAY":[{"start":"10:00","end":"21:00"}]}',
  1,
  '2025-04-28T00:00:00.000Z',
  '2025-04-28T00:00:00.000Z'
);

-- Dining Areas
INSERT INTO dining_areas (id, restaurant_id, area_id, name, description, environment, attributes, active, created_at)
VALUES
  ('da-001', 'rest-001', 1, 'Main Dining', 'Main indoor dining room', 'Indoor', '["default"]', 1, '2025-04-28T00:00:00.000Z'),
  ('da-002', 'rest-001', 2439, 'Garden', 'Outdoor garden patio', 'Outdoor', '["default"]', 1, '2025-04-28T00:00:00.000Z'),
  ('da-003', 'rest-001', 2632, 'VIP Lounge', 'Ultra VIP lounge area', 'Indoor', '["highTop","bar"]', 1, '2025-04-28T00:00:00.000Z');

-- Tables
INSERT INTO tables (id, restaurant_id, dining_area_id, table_number, min_covers, max_covers, status, active, created_at)
VALUES
  ('tbl-001', 'rest-001', 'da-001', '1', 1, 2, 'available', 1, '2025-04-28T00:00:00.000Z'),
  ('tbl-002', 'rest-001', 'da-001', '2', 1, 4, 'available', 1, '2025-04-28T00:00:00.000Z'),
  ('tbl-003', 'rest-001', 'da-001', '3', 2, 6, 'available', 1, '2025-04-28T00:00:00.000Z'),
  ('tbl-004', 'rest-001', 'da-002', '10', 1, 4, 'available', 1, '2025-04-28T00:00:00.000Z'),
  ('tbl-005', 'rest-001', 'da-002', '11', 2, 8, 'available', 1, '2025-04-28T00:00:00.000Z'),
  ('tbl-006', 'rest-001', 'da-003', '20', 1, 4, 'available', 1, '2025-04-28T00:00:00.000Z'),
  ('tbl-007', 'rest-001', 'da-003', '21', 2, 6, 'seated', 1, '2025-04-28T00:00:00.000Z');

-- Shifts
INSERT INTO shifts (id, restaurant_id, name, day_of_week, start_time, end_time, slot_interval_minutes, max_covers_per_slot, active, created_at)
VALUES
  ('shift-001', 'rest-001', 'Lunch', 1, '11:00', '15:00', 15, 40, 1, '2025-04-28T00:00:00.000Z'),
  ('shift-002', 'rest-001', 'Dinner', 1, '17:00', '22:00', 15, 60, 1, '2025-04-28T00:00:00.000Z'),
  ('shift-003', 'rest-001', 'Lunch', 2, '11:00', '15:00', 15, 40, 1, '2025-04-28T00:00:00.000Z'),
  ('shift-004', 'rest-001', 'Dinner', 2, '17:00', '22:00', 15, 60, 1, '2025-04-28T00:00:00.000Z'),
  ('shift-005', 'rest-001', 'Lunch', 3, '11:00', '15:00', 15, 40, 1, '2025-04-28T00:00:00.000Z'),
  ('shift-006', 'rest-001', 'Dinner', 3, '17:00', '22:00', 15, 60, 1, '2025-04-28T00:00:00.000Z'),
  ('shift-007', 'rest-001', 'Lunch', 4, '11:00', '15:00', 15, 40, 1, '2025-04-28T00:00:00.000Z'),
  ('shift-008', 'rest-001', 'Dinner', 4, '17:00', '23:00', 15, 60, 1, '2025-04-28T00:00:00.000Z'),
  ('shift-009', 'rest-001', 'Lunch', 5, '11:00', '15:00', 15, 40, 1, '2025-04-28T00:00:00.000Z'),
  ('shift-010', 'rest-001', 'Dinner', 5, '17:00', '23:00', 15, 60, 1, '2025-04-28T00:00:00.000Z'),
  ('shift-011', 'rest-001', 'Brunch', 6, '10:00', '15:00', 15, 50, 1, '2025-04-28T00:00:00.000Z'),
  ('shift-012', 'rest-001', 'Dinner', 6, '17:00', '23:00', 15, 60, 1, '2025-04-28T00:00:00.000Z'),
  ('shift-013', 'rest-001', 'Brunch', 0, '10:00', '15:00', 15, 50, 1, '2025-04-28T00:00:00.000Z'),
  ('shift-014', 'rest-001', 'Dinner', 0, '17:00', '21:00', 15, 60, 1, '2025-04-28T00:00:00.000Z');

-- Booking Policies
INSERT INTO booking_policies (id, restaurant_id, policy_type, message, language_code, language_region, active, created_at)
VALUES (
  'bp-001',
  'rest-001',
  'General',
  'We have a 15 minute grace period. Please call us if you are running later than 15 minutes after your reservation time.<br /><br />Your table will be reserved for 1 hour 30 minutes for parties of up to 2; 2 hours for parties of up to 4; 2 hours 30 minutes for parties of up to 6; and 3 hours for parties of 7+.',
  'en',
  'US',
  1,
  '2025-04-28T00:00:00.000Z'
);

-- Cancellation Policies
INSERT INTO cancellation_policies (id, restaurant_id, policy_type, deposit_amount, deposit_currency, deposit_denominator, deposit_type, cutoff_type, cutoff_value, active, created_at)
VALUES (
  'cp-001',
  'rest-001',
  'Deposit',
  1500,
  'USD',
  100,
  'PerGuest',
  'DaysBefore',
  2,
  1,
  '2025-04-28T00:00:00.000Z'
);

-- Experiences
INSERT INTO experiences (id, restaurant_id, experience_id, version, name, description, currency, currency_denominator, bookable, prepaid, price, has_mandatory_tip, is_tip_taxable, active, created_at, updated_at)
VALUES (
  'exp-001',
  'rest-001',
  511659,
  2,
  'Chef''s Tasting Menu',
  'A curated 5-course tasting menu featuring seasonal ingredients from local farms. Includes wine pairings.',
  'USD',
  100,
  1,
  1,
  10000,
  1,
  0,
  1,
  '2025-04-28T00:00:00.000Z',
  '2025-04-28T00:00:00.000Z'
);

INSERT INTO experience_prices (id, experience_id, price_id, title, description, price, price_all_inclusive)
VALUES
  ('ep-001', 'exp-001', 121058, 'Adult', 'Adult price', 10000, 0),
  ('ep-002', 'exp-001', 121059, 'Child', 'Child price (12 and under)', 5000, 0);

INSERT INTO experience_addon_groups (id, experience_id, name, description, max_per_reservation)
VALUES ('eag-001', 'exp-001', 'Experience Add-ons', 'Optional add-ons for your experience', 20);

INSERT INTO experience_addons (id, group_id, addon_id, name, description, max_per_reservation, price_min_unit_amount, price_multiplier, currency_code, service_charges)
VALUES (
  'ea-001',
  'eag-001',
  '3de22255-8af7-42dd-aade-e6b4cfc767d7',
  'Wine Pairing Upgrade',
  'Premium wine pairing with each course',
  10,
  2500,
  100,
  'USD',
  '[{"serviceChargeId":1,"label":"Service fee","numerator":200,"denominator":10000,"mandatory":true,"taxable":true,"description":"Service"}]'
);

INSERT INTO experience_taxes (id, experience_id, tax_id, tax_percent, label)
VALUES ('et-001', 'exp-001', 1, 10.0, 'Sales Tax');

INSERT INTO experience_service_charges (id, experience_id, service_charge_id, label, numerator, denominator, mandatory, taxable, description)
VALUES ('esc-001', 'exp-001', 1, 'Service fee', 200, 10000, 1, 1, 'Service');

-- Guests
INSERT INTO guests (id, restaurant_id, rid, sequence_id, gpid, first_name, last_name, email, email_optin, phone, phone_type, phone_numbers, tags, company_name, notes, forgotten, archived, is_hidden, mail_opted_in, marketing_opted_out, date_first_visit, date_last_visit, date_first_visit_utc, date_last_visit_utc, created_at, updated_at, created_at_utc, updated_at_utc)
VALUES (
  'guest-001',
  'rest-001',
  1038007,
  838,
  '170193493817',
  'John',
  'Doe',
  'john.doe@email.com',
  1,
  '2125555555',
  'Mobile',
  '[{"label":"Mobile","number":"2125555555","country_code":"1","primary":true}]',
  '["gc:profile/regular","gc:diet/vegetarian"]',
  '',
  NULL,
  0,
  0,
  0,
  0,
  0,
  '2024-12-20T05:00:00',
  '2025-01-12T15:00:00',
  '2024-12-20T13:00:00Z',
  '2025-01-12T23:00:00Z',
  '2024-12-20T08:09:19',
  '2025-01-12T15:25:39',
  '2024-12-20T16:09:19Z',
  '2025-01-12T23:25:39Z'
);

INSERT INTO guests (id, restaurant_id, rid, sequence_id, first_name, last_name, email, email_optin, phone, phone_type, phone_numbers, forgotten, archived, is_hidden, mail_opted_in, marketing_opted_out, created_at, updated_at, created_at_utc, updated_at_utc)
VALUES (
  'guest-002',
  'rest-001',
  1038007,
  839,
  'Jane',
  'Smith',
  'jane.smith@email.com',
  1,
  '4155555555',
  'Mobile',
  '[{"label":"Mobile","number":"4155555555","country_code":"1","primary":true}]',
  0,
  0,
  0,
  1,
  0,
  '2025-01-15T10:00:00',
  '2025-04-20T12:00:00',
  '2025-01-15T18:00:00Z',
  '2025-04-20T20:00:00Z'
);

-- Guest Tag Definitions
INSERT INTO guest_tag_definitions (id, restaurant_id, tag_id, display_name, category, created_at)
VALUES
  ('gtd-001', 'rest-001', '101', 'Pizza Club Member', 'special_guests', '2025-04-28T00:00:00.000Z'),
  ('gtd-002', 'rest-001', '102', 'Celiac', 'dietary_needs', '2025-04-28T00:00:00.000Z'),
  ('gtd-003', 'rest-001', '103', 'Wine Locker Member', 'special_guests', '2025-04-28T00:00:00.000Z'),
  ('gtd-004', 'rest-001', '104', 'Lactose intolerance', 'dietary_needs', '2025-04-28T00:00:00.000Z');

-- Guest Tag Assignments
INSERT INTO guest_tag_assignments (id, guest_id, tag_id, created_at)
VALUES
  ('gta-001', 'guest-001', '101', '2025-04-28T00:00:00.000Z'),
  ('gta-002', 'guest-001', '103', '2025-04-28T00:00:00.000Z');

-- Reservations
INSERT INTO reservations (id, restaurant_id, rid, guest_id, confirmation_id, sequence_id, state, table_number, party_size, scheduled_time, scheduled_time_utc, reservation_attribute, origin, guest_request, dining_area_id, environment, server, visit_tags, created_at, updated_at, created_at_utc, updated_at_utc)
VALUES (
  'res-001',
  'rest-001',
  1038007,
  'guest-001',
  15989,
  86941,
  'Confirmed',
  '["10"]',
  4,
  '2025-05-14T19:30:00',
  '2025-05-15T00:30:00Z',
  'default',
  'Web',
  'Birthday celebration - window table please',
  1,
  'Indoor',
  'John Doe',
  '["gc:service/date","birthday"]',
  '2025-04-25T06:31:39',
  '2025-04-28T14:00:36',
  '2025-04-25T11:31:39Z',
  '2025-04-28T19:00:36Z'
);

INSERT INTO reservations (id, restaurant_id, rid, guest_id, confirmation_id, sequence_id, state, table_number, party_size, scheduled_time, scheduled_time_utc, reservation_attribute, origin, guest_request, dining_area_id, environment, visit_tags, seated_time, seated_time_utc, done_time, done_time_utc, pos_data, created_at, updated_at, created_at_utc, updated_at_utc)
VALUES (
  'res-002',
  'rest-001',
  1038007,
  'guest-002',
  15990,
  86942,
  'Completed',
  '["2"]',
  2,
  '2025-04-20T18:00:00',
  '2025-04-20T23:00:00Z',
  'default',
  'Web',
  'Anniversary dinner',
  1,
  'Indoor',
  '["gc:service/date"]',
  '2025-04-20T18:05:00',
  '2025-04-20T23:05:00Z',
  '2025-04-20T20:15:00',
  '2025-04-21T01:15:00Z',
  '{"check_ids":["20250420-30025"],"pos_sub_total":8100,"pos_tax":891,"pos_tip":1730,"pos_total_spend":10721}',
  '2025-04-10T12:00:00',
  '2025-04-20T20:15:00',
  '2025-04-10T17:00:00Z',
  '2025-04-21T01:15:00Z'
);

INSERT INTO reservations (id, restaurant_id, rid, guest_id, confirmation_id, sequence_id, state, party_size, scheduled_time, scheduled_time_utc, reservation_attribute, origin, cancellation_date, cancellation_date_utc, created_at, updated_at, created_at_utc, updated_at_utc)
VALUES (
  'res-003',
  'rest-001',
  1038007,
  'guest-001',
  15991,
  86943,
  'Cancelled',
  2,
  '2025-04-22T19:00:00',
  '2025-04-23T00:00:00Z',
  'default',
  'Web',
  '2025-04-21T10:00:00',
  '2025-04-21T15:00:00Z',
  '2025-04-15T08:00:00',
  '2025-04-21T10:00:00',
  '2025-04-15T13:00:00Z',
  '2025-04-21T15:00:00Z'
);

-- Reviews
INSERT INTO reviews (id, restaurant_id, rid, review_id, reservation_id, gp_id, country_code, customer_nickname, locale, language, metro_id, moderation_state, simplified_moderation_state, rating_overall, rating_food, rating_service, rating_ambience, rating_value, rating_noise, recommended, review_text, dined_date_time, submission_date_time_utc, last_modified_date_time_utc, categories, photos, diner_initials, diner_metro_id, diner_is_vip, helpfulness_up, helpfulness_down, featured, is_draft, created_at)
VALUES (
  'rev-001',
  'rest-001',
  1038007,
  'OT-1038007-2144-170223310557',
  1730789203,
  '170223310557',
  'US',
  'JohnD',
  'en-US',
  'en',
  1,
  2,
  'APPROVED',
  5,
  5,
  5,
  5,
  5,
  2,
  1,
  'This is the best restaurant I''ve ever been to. Outstanding food and impeccable service. The tasting menu was an absolute delight.',
  '2025-04-15T19:30:00-05:00',
  '2025-04-17T12:20:33Z',
  '2025-04-17T12:20:33Z',
  '[{"Id":"Fancy","Label":"Fancy"},{"Id":"GreatBeer","Label":"Great for craft beers"},{"Id":"ChildFriendly","Label":"Kid-friendly"}]',
  '[{"Type":"Dff","Key":"70726782","Caption":"","ShowCaption":true}]',
  'J',
  1,
  0,
  3,
  0,
  0,
  0,
  '2025-04-17T12:20:33Z'
);

INSERT INTO reviews (id, restaurant_id, rid, review_id, reservation_id, country_code, customer_nickname, locale, language, metro_id, moderation_state, simplified_moderation_state, rating_overall, rating_food, rating_service, rating_ambience, rating_value, rating_noise, recommended, review_text, dined_date_time, submission_date_time_utc, last_modified_date_time_utc, categories, diner_initials, diner_metro_id, diner_is_vip, helpfulness_up, helpfulness_down, featured, is_draft, created_at)
VALUES (
  'rev-002',
  'rest-001',
  1038007,
  'OT-1038007-2145-170223310558',
  1730789204,
  'US',
  'JaneS',
  'en-US',
  'en',
  1,
  2,
  'APPROVED',
  4,
  5,
  4,
  4,
  4,
  3,
  1,
  'Great food but the wait was a bit long. The ambience is wonderful and the cocktails are top notch.',
  '2025-04-20T18:00:00-05:00',
  '2025-04-22T10:15:00Z',
  '2025-04-22T10:15:00Z',
  '[{"Id":"Romance","Label":"Romantic"},{"Id":"Brunch","Label":"Great for brunch"}]',
  'J',
  1,
  0,
  1,
  0,
  0,
  0,
  '2025-04-22T10:15:00Z'
);

-- Menus
INSERT INTO menus (id, restaurant_id, rid, menu_id, name, description, currency, ordinal, created_at, updated_at)
VALUES
  ('menu-001', 'rest-001', 1038007, '05c4f607-8162-442f-a9f6-f6357d286d78', 'Happy Hour', 'Daily, 3pm - 6pm & 9pm - close', 'USD', 1, '2025-04-28T00:00:00.000Z', '2025-04-28T00:00:00.000Z'),
  ('menu-002', 'rest-001', 1038007, 'cdad1e9a-f269-4981-9173-50728be964df', 'Dinner Menu', 'Monday - Saturday, 5pm - Close', 'USD', 2, '2025-04-28T00:00:00.000Z', '2025-04-28T00:00:00.000Z');

INSERT INTO menu_groups (id, menu_id, group_id, name, description, ordinal)
VALUES
  ('mg-001', 'menu-001', '12ed7fb6-7bc5-4c18-8b95-51996088cc71', 'Small Plates', 'Appetizers and shareable plates', 100),
  ('mg-002', 'menu-001', '5ee8d10a-3a3c-4fb7-bbbc-224d57c3f5c3', 'Cocktails', 'Signature cocktails and drinks', 200),
  ('mg-003', 'menu-002', '3f7411b1-e82b-4353-978f-82f2d67efb92', 'Starters', 'Choice of one', 100),
  ('mg-004', 'menu-002', 'e40966a0-9511-47ac-b05f-672e62c1123c', 'Entrees', 'Choice of one', 200);

INSERT INTO menu_items (id, group_id, item_id, name, description, ordinal, price_amount, price_currency, price_denominator, tags, modifier_groups)
VALUES
  ('mi-001', 'mg-001', '692d4fc3-5481-4384-bb69-315c825576b5', 'Bruschetta', 'Heirloom tomatoes, basil, aged balsamic', 100, 1200, 'USD', 100, '[]', '[]'),
  ('mi-002', 'mg-001', '2bc6d339-4a80-4079-9979-99202d42dace', 'Crispy Calamari', 'Lemon aioli, marinara', 200, 1500, 'USD', 100, '[]', '[]'),
  ('mi-003', 'mg-002', '1d218933-83cd-4638-b155-fdf48e7e8e25', 'Old Fashioned', 'Bourbon, bitters, orange peel', 100, 1400, 'USD', 100, '[]', '[]'),
  ('mi-004', 'mg-003', 'fa8d9df2-6219-4e74-89bf-df31eb5538e9', 'French Onion Soup', 'Gruyere crouton', 100, 1200, 'USD', 100, '[]', '[]'),
  ('mi-005', 'mg-004', '64ea6966-6283-48b1-b117-ffce2440eef5', 'NY Strip', '14oz dry-aged, roasted vegetables', 100, 4500, 'USD', 100, '[]', '[]'),
  ('mi-006', 'mg-004', '28e2935b-61c2-4ed2-8cf1-1896828d146e', 'Pan-Seared Salmon', 'Lemon butter, asparagus', 200, 3200, 'USD', 100, '[]', '[]');

-- POS Restaurant
INSERT INTO pos_restaurants (id, restaurant_id, rid, restaurant_name, source_location_id, pos_type, status, source_location_status, datetime_of_first_check, datetime_of_last_check, created_at, updated_at)
VALUES (
  'pos-001',
  'rest-001',
  1038007,
  'Vogel''s Bistro',
  '1038007',
  'freerez',
  'enabled',
  'online',
  '2025-01-01T00:00:00Z',
  '2025-04-28T12:00:00Z',
  '2025-04-28T00:00:00.000Z',
  '2025-04-28T00:00:00.000Z'
);

-- Webhook Subscription
INSERT INTO webhook_subscriptions (id, restaurant_id, partner_id, url, events, secret, active, created_at, updated_at)
VALUES (
  'wh-001',
  'rest-001',
  'partner-001',
  'https://example.com/webhooks/freerez',
  '["reservation.created","reservation.updated","reservation.cancelled"]',
  'whsec_test_secret_123',
  1,
  '2025-04-28T00:00:00.000Z',
  '2025-04-28T00:00:00.000Z'
);

-- Restaurant Staff
INSERT INTO restaurant_staff (id, restaurant_id, user_id, role, active, created_at)
VALUES ('staff-001', 'rest-001', 'user-001', 'owner', 1, '2025-04-28T00:00:00.000Z');

-- Guest Loyalties
INSERT INTO guest_loyalties (id, guest_id, program_name, loyalty_tier, points_balance, account_id, flex_fields, created_at, updated_at)
VALUES (
  'gl-001',
  'guest-001',
  'FreeRez Loyalty',
  'Gold',
  '1500',
  'LOYALTY-001',
  '[{"label":"Favorite Meal","value":"NY Strip"},{"label":"Benefits","value":"Priority Seating"}]',
  '2025-04-28T00:00:00.000Z',
  '2025-04-28T00:00:00.000Z'
);

-- Guest Insights
INSERT INTO guest_insights (id, guest_id, label, value, created_at, updated_at)
VALUES
  ('gi-001', 'guest-001', 'Average check size', '$85', '2025-04-28T00:00:00.000Z', '2025-04-28T00:00:00.000Z'),
  ('gi-002', 'guest-001', 'Dining frequency', '2 times per month', '2025-04-28T00:00:00.000Z', '2025-04-28T00:00:00.000Z');

-- Private Dining Lead
INSERT INTO private_dining_leads (id, restaurant_id, rid, first_name, last_name, email, phone_number, event_date, event_time, party_size, event_type, flexible_date, status, created_at, updated_at)
VALUES (
  'pdl-001',
  'rest-001',
  1038007,
  'Sarah',
  'Johnson',
  'sarah@example.com',
  '1 555 123 4567',
  '2025-06-15',
  '18:30',
  50,
  'Wedding',
  1,
  'new',
  '2025-04-28T00:00:00.000Z',
  '2025-04-28T00:00:00.000Z'
);
