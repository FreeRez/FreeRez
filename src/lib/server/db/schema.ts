import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

const timestamp = (name: string) =>
	text(name).$defaultFn(() => new Date().toISOString());

const id = () =>
	text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID());

// ─── Auth (BetterAuth managed) ───────────────────────────────────────────────

export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: integer('email_verified', { mode: 'boolean' }).default(false),
	image: text('image'),
	role: text('role', { enum: ['admin', 'owner', 'manager', 'host', 'server', 'staff'] })
		.default('staff'),
	createdAt: timestamp('created_at'),
	updatedAt: timestamp('updated_at')
});

export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	token: text('token').notNull().unique(),
	expiresAt: text('expires_at').notNull(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	createdAt: timestamp('created_at'),
	updatedAt: timestamp('updated_at')
});

export const accounts = sqliteTable('accounts', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	accessTokenExpiresAt: text('access_token_expires_at'),
	refreshTokenExpiresAt: text('refresh_token_expires_at'),
	scope: text('scope'),
	idToken: text('id_token'),
	password: text('password'),
	createdAt: timestamp('created_at'),
	updatedAt: timestamp('updated_at')
});

export const verifications = sqliteTable('verifications', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: text('expires_at').notNull(),
	createdAt: timestamp('created_at'),
	updatedAt: timestamp('updated_at')
});

// ─── OAuth API Clients ──────────────────────────────────────────────────────
// NOTE: api_clients and api_tokens now live in the control plane DB.
// See: src/lib/server/control-plane/schema.ts

// ─── Restaurants ─────────────────────────────────────────────────────────────

export const restaurants = sqliteTable(
	'restaurants',
	{
		id: id(),
		rid: integer('rid').notNull().unique(),
		ownerId: text('owner_id').references(() => users.id),
		name: text('name').notNull(),
		description: text('description'),
		primaryCuisine: text('primary_cuisine'),
		phone: text('phone'),
		currency: text('currency').default('USD'),
		locale: text('locale').default('en-US'),
		website: text('website'),
		timezone: text('timezone').default('America/New_York'),
		priceBandId: integer('price_band_id'),
		diningStyle: text('dining_style'),
		dressCode: text('dress_code'),
		executiveChef: text('executive_chef'),
		crossStreet: text('cross_street'),
		privateEventDetails: text('private_event_details'),
		cateringDetails: text('catering_details'),
		address: text('address'),
		address2: text('address2'),
		city: text('city'),
		state: text('state'),
		country: text('country').default('US'),
		postalCode: text('postal_code'),
		latitude: real('latitude'),
		longitude: real('longitude'),
		metroName: text('metro_name'),
		neighborhoodName: text('neighborhood_name'),
		profilePhotoUrl: text('profile_photo_url'),
		reservationUrl: text('reservation_url'),
		profileUrl: text('profile_url'),
		tags: text('tags', { mode: 'json' }).$type<string[]>(),
		openingTimes: text('opening_times', { mode: 'json' }).$type<Record<string, Array<{ start: string; end: string }>>>(),
		floorPlanLayout: text('floor_plan_layout', { mode: 'json' }).$type<Record<string, unknown>>(),
		activeLayoutId: text('active_layout_id'),
		active: integer('active', { mode: 'boolean' }).default(true),
		createdAt: timestamp('created_at'),
		updatedAt: timestamp('updated_at')
	},
	(t) => [
		index('idx_restaurants_rid').on(t.rid),
		index('idx_restaurants_city').on(t.city),
		index('idx_restaurants_country').on(t.country)
	]
);

// ─── Floor Plan Layouts ─────────────────────────────────────────────────────

export const floorPlanLayouts = sqliteTable(
	'floor_plan_layouts',
	{
		id: id(),
		restaurantId: text('restaurant_id')
			.notNull()
			.references(() => restaurants.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		layoutData: text('layout_data', { mode: 'json' }).$type<Record<string, unknown>>(),
		isDefault: integer('is_default', { mode: 'boolean' }).default(false),
		createdAt: timestamp('created_at'),
		updatedAt: timestamp('updated_at')
	},
	(t) => [
		index('idx_floor_plan_layouts_restaurant').on(t.restaurantId)
	]
);

// ─── Restaurant Staff ────────────────────────────────────────────────────────

export const restaurantStaff = sqliteTable(
	'restaurant_staff',
	{
		id: id(),
		restaurantId: text('restaurant_id')
			.notNull()
			.references(() => restaurants.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		role: text('role', { enum: ['owner', 'manager', 'host', 'server'] }).notNull(),
		active: integer('active', { mode: 'boolean' }).default(true),
		inviteToken: text('invite_token'),
		inviteExpiresAt: text('invite_expires_at'),
		createdAt: timestamp('created_at'),
		updatedAt: timestamp('updated_at')
	},
	(t) => [uniqueIndex('idx_staff_restaurant_user').on(t.restaurantId, t.userId)]
);

// ─── Partner Integrations ────────────────────────────────────────────────────

export const partnerIntegrations = sqliteTable('partner_integrations', {
	id: id(),
	restaurantId: text('restaurant_id')
		.notNull()
		.references(() => restaurants.id, { onDelete: 'cascade' }),
	partnerId: text('partner_id').notNull(),
	partnerIdentifier: text('partner_identifier'),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	tokenExpiresAt: text('token_expires_at'),
	status: text('status', { enum: ['active', 'inactive', 'pending'] })
		.notNull()
		.default('pending'),
	metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
	createdAt: timestamp('created_at'),
	updatedAt: timestamp('updated_at')
});

// ─── Dining Areas ────────────────────────────────────────────────────────────

export const diningAreas = sqliteTable('dining_areas', {
	id: id(),
	restaurantId: text('restaurant_id')
		.notNull()
		.references(() => restaurants.id, { onDelete: 'cascade' }),
	areaId: integer('area_id').notNull(),
	name: text('name').notNull(),
	description: text('description'),
	environment: text('environment', { enum: ['Indoor', 'Outdoor'] }),
	attributes: text('attributes', { mode: 'json' }).$type<string[]>(),
	active: integer('active', { mode: 'boolean' }).default(true),
	createdAt: timestamp('created_at')
});

// ─── Tables ──────────────────────────────────────────────────────────────────

export const tables = sqliteTable(
	'tables',
	{
		id: id(),
		restaurantId: text('restaurant_id')
			.notNull()
			.references(() => restaurants.id, { onDelete: 'cascade' }),
		diningAreaId: text('dining_area_id').references(() => diningAreas.id),
		tableNumber: text('table_number').notNull(),
		minCovers: integer('min_covers').default(1),
		maxCovers: integer('max_covers').notNull(),
		status: text('status', { enum: ['available', 'seated', 'dirty', 'reserved', 'blocked'] })
			.notNull()
			.default('available'),
		positionX: real('position_x'),
		positionY: real('position_y'),
		shape: text('shape', { enum: ['square', 'round', 'rectangle'] }).default('square'),
		active: integer('active', { mode: 'boolean' }).default(true),
		createdAt: timestamp('created_at')
	},
	(t) => [index('idx_tables_restaurant').on(t.restaurantId)]
);

// ─── Shifts / Service Periods ────────────────────────────────────────────────

export const shifts = sqliteTable('shifts', {
	id: id(),
	restaurantId: text('restaurant_id')
		.notNull()
		.references(() => restaurants.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	dayOfWeek: integer('day_of_week').notNull(),
	startTime: text('start_time').notNull(),
	endTime: text('end_time').notNull(),
	slotIntervalMinutes: integer('slot_interval_minutes').default(15),
	maxCoversPerSlot: integer('max_covers_per_slot'),
	active: integer('active', { mode: 'boolean' }).default(true),
	createdAt: timestamp('created_at')
});

// ─── Server Sections ────────────────────────────────────────────────────────

export const serverSections = sqliteTable(
	'server_sections',
	{
		id: id(),
		restaurantId: text('restaurant_id')
			.notNull()
			.references(() => restaurants.id, { onDelete: 'cascade' }),
		staffId: text('staff_id')
			.notNull()
			.references(() => restaurantStaff.id, { onDelete: 'cascade' }),
		shiftId: text('shift_id')
			.references(() => shifts.id, { onDelete: 'set null' }),
		date: text('date').notNull(),
		name: text('name').notNull(),
		color: text('color').notNull(),
		active: integer('active', { mode: 'boolean' }).default(true),
		createdAt: timestamp('created_at'),
		updatedAt: timestamp('updated_at')
	},
	(t) => [
		index('idx_server_sections_restaurant_date').on(t.restaurantId, t.date),
		index('idx_server_sections_staff').on(t.staffId)
	]
);

export const serverSectionTables = sqliteTable(
	'server_section_tables',
	{
		id: id(),
		sectionId: text('section_id')
			.notNull()
			.references(() => serverSections.id, { onDelete: 'cascade' }),
		tableId: text('table_id')
			.notNull()
			.references(() => tables.id, { onDelete: 'cascade' })
	},
	(t) => [
		uniqueIndex('idx_section_table_unique').on(t.sectionId, t.tableId),
		index('idx_section_tables_section').on(t.sectionId)
	]
);

// ─── Guests ──────────────────────────────────────────────────────────────────

export const guests = sqliteTable(
	'guests',
	{
		id: id(),
		restaurantId: text('restaurant_id')
			.notNull()
			.references(() => restaurants.id, { onDelete: 'cascade' }),
		rid: integer('rid').notNull(),
		sequenceId: integer('sequence_id')
			.notNull()
			.$defaultFn(() => Date.now()),
		gpid: text('gpid'),
		firstName: text('first_name'),
		lastName: text('last_name'),
		email: text('email'),
		emailOptin: integer('email_optin', { mode: 'boolean' }).default(false),
		phone: text('phone'),
		phoneType: text('phone_type'),
		phoneNumbers: text('phone_numbers', { mode: 'json' }).$type<
			Array<{ label: string; number: string; country_code: string; primary: boolean }>
		>(),
		tags: text('tags', { mode: 'json' }).$type<string[]>(),
		birthDate: text('birth_date'),
		anniversaryDate: text('anniversary_date', { mode: 'json' }).$type<{
			name: string;
			year: number;
			month: number;
			day: number;
		} | null>(),
		companyName: text('company_name'),
		notes: text('notes'),
		notesSpecialRelationship: text('notes_special_relationship'),
		notesFoodAndDrink: text('notes_food_and_drink'),
		notesSeating: text('notes_seating'),
		address: text('address', { mode: 'json' }).$type<{
			street1?: string;
			street2?: string;
			city?: string;
			state?: string;
			country?: string;
			zip?: string;
		} | null>(),
		forgotten: integer('forgotten', { mode: 'boolean' }).default(false),
		archived: integer('archived', { mode: 'boolean' }).default(false),
		isHidden: integer('is_hidden', { mode: 'boolean' }).default(false),
		mailOptedIn: integer('mail_opted_in', { mode: 'boolean' }).default(false),
		marketingOptedOut: integer('marketing_opted_out', { mode: 'boolean' }).default(false),
		smsOptIn: integer('sms_opt_in', { mode: 'boolean' }),
		primaryGuest: text('primary_guest'),
		dateFirstVisit: text('date_first_visit'),
		dateLastVisit: text('date_last_visit'),
		dateFirstVisitUtc: text('date_first_visit_utc'),
		dateLastVisitUtc: text('date_last_visit_utc'),
		dateEmailOptInOptOut: text('date_email_opt_in_opt_out'),
		dateEmailOptInOptOutUtc: text('date_email_opt_in_opt_out_utc'),
		photoUrl: text('photo_url'),
		photoStatus: text('photo_status', { enum: ['PENDING', 'APPROVED', 'REJECTED'] }),
		createdAt: timestamp('created_at'),
		updatedAt: timestamp('updated_at'),
		createdAtUtc: text('created_at_utc'),
		updatedAtUtc: text('updated_at_utc')
	},
	(t) => [
		index('idx_guests_restaurant').on(t.restaurantId),
		index('idx_guests_email').on(t.email),
		index('idx_guests_rid').on(t.rid)
	]
);

// ─── Guest Loyalties ─────────────────────────────────────────────────────────

export const guestLoyalties = sqliteTable('guest_loyalties', {
	id: id(),
	guestId: text('guest_id')
		.notNull()
		.references(() => guests.id, { onDelete: 'cascade' }),
	programName: text('program_name').notNull(),
	loyaltyTier: text('loyalty_tier'),
	pointsBalance: text('points_balance'),
	accountId: text('account_id'),
	flexFields: text('flex_fields', { mode: 'json' }).$type<
		Array<{ label: string; value: string }>
	>(),
	createdAt: timestamp('created_at'),
	updatedAt: timestamp('updated_at')
});

// ─── Guest Tags ──────────────────────────────────────────────────────────────

export const guestTagDefinitions = sqliteTable(
	'guest_tag_definitions',
	{
		id: id(),
		restaurantId: text('restaurant_id')
			.notNull()
			.references(() => restaurants.id, { onDelete: 'cascade' }),
		tagId: text('tag_id').notNull(),
		displayName: text('display_name').notNull(),
		category: text('category').notNull(),
		createdAt: timestamp('created_at')
	},
	(t) => [uniqueIndex('idx_tag_def_restaurant_tag').on(t.restaurantId, t.tagId)]
);

export const guestTagAssignments = sqliteTable(
	'guest_tag_assignments',
	{
		id: id(),
		guestId: text('guest_id')
			.notNull()
			.references(() => guests.id, { onDelete: 'cascade' }),
		tagId: text('tag_id').notNull(),
		createdAt: timestamp('created_at')
	},
	(t) => [uniqueIndex('idx_tag_assignment_guest_tag').on(t.guestId, t.tagId)]
);

// ─── Guest Properties (Hotel integration) ────────────────────────────────────

export const guestProperties = sqliteTable('guest_properties', {
	id: id(),
	guestId: text('guest_id')
		.notNull()
		.references(() => guests.id, { onDelete: 'cascade' }),
	propertyName: text('property_name').notNull(),
	resStatusCode: text('res_status_code'),
	reservationId: text('reservation_id'),
	resArriveDate: text('res_arrive_date'),
	resDepartDate: text('res_depart_date'),
	roomNumber: text('room_number'),
	rateCode: text('rate_code'),
	flexFields: text('flex_fields', { mode: 'json' }).$type<
		Array<{ label: string; value: string }>
	>(),
	createdAt: timestamp('created_at'),
	updatedAt: timestamp('updated_at')
});

// ─── Guest Insights ──────────────────────────────────────────────────────────

export const guestInsights = sqliteTable('guest_insights', {
	id: id(),
	guestId: text('guest_id')
		.notNull()
		.references(() => guests.id, { onDelete: 'cascade' }),
	label: text('label').notNull(),
	value: text('value').notNull(),
	createdAt: timestamp('created_at'),
	updatedAt: timestamp('updated_at')
});

// ─── Experiences ─────────────────────────────────────────────────────────────

export const experiences = sqliteTable('experiences', {
	id: id(),
	restaurantId: text('restaurant_id')
		.notNull()
		.references(() => restaurants.id, { onDelete: 'cascade' }),
	experienceId: integer('experience_id').notNull(),
	version: integer('version').notNull().default(1),
	name: text('name').notNull(),
	description: text('description'),
	currency: text('currency').default('USD'),
	currencyDenominator: integer('currency_denominator').default(100),
	bookable: integer('bookable', { mode: 'boolean' }).default(true),
	prepaid: integer('prepaid', { mode: 'boolean' }).default(false),
	price: integer('price').default(0),
	hasMandatoryTip: integer('has_mandatory_tip', { mode: 'boolean' }).default(false),
	isTipTaxable: integer('is_tip_taxable', { mode: 'boolean' }).default(false),
	active: integer('active', { mode: 'boolean' }).default(true),
	createdAt: timestamp('created_at'),
	updatedAt: timestamp('updated_at')
});

export const experiencePrices = sqliteTable('experience_prices', {
	id: id(),
	experienceId: text('experience_id')
		.notNull()
		.references(() => experiences.id, { onDelete: 'cascade' }),
	priceId: integer('price_id').notNull(),
	title: text('title').notNull(),
	description: text('description'),
	price: integer('price').notNull(),
	priceAllInclusive: integer('price_all_inclusive', { mode: 'boolean' }).default(false)
});

export const experienceAddOnGroups = sqliteTable('experience_addon_groups', {
	id: id(),
	experienceId: text('experience_id')
		.notNull()
		.references(() => experiences.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	description: text('description'),
	maxPerReservation: integer('max_per_reservation').default(0)
});

export const experienceAddOns = sqliteTable('experience_addons', {
	id: id(),
	groupId: text('group_id')
		.notNull()
		.references(() => experienceAddOnGroups.id, { onDelete: 'cascade' }),
	addonId: text('addon_id')
		.notNull()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	description: text('description'),
	maxPerReservation: integer('max_per_reservation').default(20),
	priceMinUnitAmount: integer('price_min_unit_amount').default(0),
	priceMultiplier: integer('price_multiplier').default(100),
	currencyCode: text('currency_code').default('USD'),
	serviceCharges: text('service_charges', { mode: 'json' }).$type<
		Array<{
			serviceChargeId: number;
			label: string;
			numerator: number;
			denominator: number;
			mandatory: boolean;
			taxable: boolean;
			description: string;
		}>
	>()
});

export const experienceServiceCharges = sqliteTable('experience_service_charges', {
	id: id(),
	experienceId: text('experience_id')
		.notNull()
		.references(() => experiences.id, { onDelete: 'cascade' }),
	serviceChargeId: integer('service_charge_id').notNull(),
	label: text('label').notNull(),
	numerator: integer('numerator').notNull(),
	denominator: integer('denominator').notNull(),
	mandatory: integer('mandatory', { mode: 'boolean' }).default(true),
	taxable: integer('taxable', { mode: 'boolean' }).default(true),
	description: text('description')
});

export const experienceTaxes = sqliteTable('experience_taxes', {
	id: id(),
	experienceId: text('experience_id')
		.notNull()
		.references(() => experiences.id, { onDelete: 'cascade' }),
	taxId: integer('tax_id').notNull(),
	taxPercent: real('tax_percent').notNull(),
	label: text('label')
});

// ─── Cancellation & Booking Policies ─────────────────────────────────────────

export const cancellationPolicies = sqliteTable('cancellation_policies', {
	id: id(),
	restaurantId: text('restaurant_id')
		.notNull()
		.references(() => restaurants.id, { onDelete: 'cascade' }),
	policyType: text('policy_type', { enum: ['Deposit', 'CreditCard', 'None'] })
		.notNull()
		.default('None'),
	depositAmount: integer('deposit_amount'),
	depositCurrency: text('deposit_currency').default('USD'),
	depositDenominator: integer('deposit_denominator').default(100),
	depositType: text('deposit_type', { enum: ['PerGuest', 'PerReservation'] }),
	cutoffType: text('cutoff_type', { enum: ['DaysBefore', 'HoursBefore', 'MinutesBefore'] }),
	cutoffValue: integer('cutoff_value'),
	active: integer('active', { mode: 'boolean' }).default(true),
	createdAt: timestamp('created_at')
});

export const bookingPolicies = sqliteTable('booking_policies', {
	id: id(),
	restaurantId: text('restaurant_id')
		.notNull()
		.references(() => restaurants.id, { onDelete: 'cascade' }),
	policyType: text('policy_type', { enum: ['General', 'Cancellation', 'Group', 'Custom'] })
		.notNull()
		.default('General'),
	message: text('message').notNull(),
	languageCode: text('language_code').default('en'),
	languageRegion: text('language_region').default('US'),
	active: integer('active', { mode: 'boolean' }).default(true),
	createdAt: timestamp('created_at')
});

// ─── Reservations ────────────────────────────────────────────────────────────

export const reservations = sqliteTable(
	'reservations',
	{
		id: id(),
		restaurantId: text('restaurant_id')
			.notNull()
			.references(() => restaurants.id, { onDelete: 'cascade' }),
		rid: integer('rid').notNull(),
		guestId: text('guest_id').references(() => guests.id),
		confirmationId: integer('confirmation_id')
			.notNull()
			.$defaultFn(() => Math.floor(Math.random() * 2147483647)),
		sequenceId: integer('sequence_id')
			.notNull()
			.$defaultFn(() => Date.now()),
		state: text('state', {
			enum: [
				'Pending',
				'Confirmed',
				'Seated',
				'Completed',
				'Cancelled',
				'CancelledWeb',
				'NoShow'
			]
		})
			.notNull()
			.default('Pending'),
		tableNumber: text('table_number', { mode: 'json' }).$type<string[]>(),
		partySize: integer('party_size').notNull(),
		scheduledTime: text('scheduled_time').notNull(),
		scheduledTimeUtc: text('scheduled_time_utc'),
		reservationAttribute: text('reservation_attribute').default('default'),
		origin: text('origin', { enum: ['Web', 'Phone/In-house', 'App', 'Partner', 'WalkIn'] })
			.notNull()
			.default('Web'),
		guestRequest: text('guest_request'),
		venueNotes: text('venue_notes'),
		opentableNotes: text('opentable_notes'),
		tableCategory: text('table_category'),
		diningAreaId: integer('dining_area_id'),
		environment: text('environment', { enum: ['Indoor', 'Outdoor'] }),
		server: text('server'),
		visitTags: text('visit_tags', { mode: 'json' }).$type<string[]>(),
		seatedTime: text('seated_time'),
		seatedTimeUtc: text('seated_time_utc'),
		doneTime: text('done_time'),
		doneTimeUtc: text('done_time_utc'),
		arrivedTime: text('arrived_time'),
		arrivedTimeUtc: text('arrived_time_utc'),
		cancellationDate: text('cancellation_date'),
		cancellationDateUtc: text('cancellation_date_utc'),
		quotedWaitTime: integer('quoted_wait_time').default(0),
		onlineSource: text('online_source'),
		discoveryType: text('discovery_type'),
		partner: text('partner'),
		campaignDetails: text('campaign_details', { mode: 'json' }),
		creditCardStatus: text('credit_card_status'),
		restRefCampaignName: text('rest_ref_campaign_name'),
		restRefId: text('rest_ref_id'),
		restRefSource: text('rest_ref_source'),
		currencyCode: text('currency_code'),
		currencyDenominator: integer('currency_denominator').default(100),
		smsNotificationsOptIn: integer('sms_notifications_opt_in', { mode: 'boolean' }),
		marketingOptedOut: integer('marketing_opted_out', { mode: 'boolean' }).default(false),
		restaurantEmailMarketingOptIn: integer('restaurant_email_marketing_opt_in', {
			mode: 'boolean'
		}).default(false),
		manageReservationUrl: text('manage_reservation_url'),
		experienceDetails: text('experience_details', { mode: 'json' }).$type<{
			experience_id: number;
			experience_title: string;
			experience_description: string;
			subtotalAmount: number;
			add_ons: Array<{
				ItemID: string;
				Quantity: number;
				Price: number;
				LineTotal: number;
				LineSubtotalWithTaxes: number;
				TaxAmount: number;
				Name: string;
				Description: string;
			}>;
			addon_subtotal_amount: number;
			diner_payment_status: string | null;
			service_fee_amount: number;
			taxes_amount: number;
			tip_amount: number;
			total_amount: number;
		} | null>(),
		depositDetails: text('deposit_details', { mode: 'json' }).$type<{
			totalPaid: number | null;
			totalRefunded: number | null;
			currency: string | null;
			currencyDenominator: number;
			status: string | null;
		} | null>(),
		referrer: text('referrer', { mode: 'json' }).$type<{
			company: string;
			id: string;
			first_name: string;
			last_name: string;
			email: string;
			phone: string;
		} | null>(),
		posData: text('pos_data', { mode: 'json' }).$type<{
			check_ids: string[] | null;
			pos_sub_total: number | null;
			pos_tax: number | null;
			pos_tip: number | null;
			pos_total_spend: number | null;
		} | null>(),
		addedToWaitlist: text('added_to_waitlist'),
		addedToWaitlistUtc: text('added_to_waitlist_utc'),
		createdAt: timestamp('created_at'),
		updatedAt: timestamp('updated_at'),
		createdAtUtc: text('created_at_utc'),
		updatedAtUtc: text('updated_at_utc')
	},
	(t) => [
		index('idx_reservations_restaurant').on(t.restaurantId),
		index('idx_reservations_rid').on(t.rid),
		index('idx_reservations_guest').on(t.guestId),
		index('idx_reservations_scheduled').on(t.scheduledTime),
		index('idx_reservations_state').on(t.state),
		index('idx_reservations_confirmation').on(t.confirmationId)
	]
);

// ─── Slot Locks ──────────────────────────────────────────────────────────────

export const slotLocks = sqliteTable('slot_locks', {
	id: id(),
	restaurantId: text('restaurant_id')
		.notNull()
		.references(() => restaurants.id, { onDelete: 'cascade' }),
	reservationToken: text('reservation_token').notNull().unique(),
	partySize: integer('party_size').notNull(),
	dateTime: text('date_time').notNull(),
	reservationAttribute: text('reservation_attribute').default('default'),
	diningAreaId: integer('dining_area_id'),
	environment: text('environment'),
	experienceData: text('experience_data', { mode: 'json' }),
	expiresAt: text('expires_at').notNull(),
	createdAt: timestamp('created_at')
});

// ─── POS Data ────────────────────────────────────────────────────────────────

export const posRestaurants = sqliteTable('pos_restaurants', {
	id: id(),
	restaurantId: text('restaurant_id')
		.notNull()
		.references(() => restaurants.id, { onDelete: 'cascade' }),
	rid: integer('rid').notNull(),
	restaurantName: text('restaurant_name').notNull(),
	sourceLocationId: text('source_location_id'),
	posType: text('pos_type'),
	status: text('status', { enum: ['enabled', 'disabled'] })
		.notNull()
		.default('enabled'),
	sourceLocationStatus: text('source_location_status', { enum: ['online', 'offline'] })
		.notNull()
		.default('online'),
	datetimeOfFirstCheck: text('datetime_of_first_check'),
	datetimeOfLastCheck: text('datetime_of_last_check'),
	createdAt: timestamp('created_at'),
	updatedAt: timestamp('updated_at')
});

export const posTickets = sqliteTable(
	'pos_tickets',
	{
		id: id(),
		restaurantId: text('restaurant_id')
			.notNull()
			.references(() => restaurants.id, { onDelete: 'cascade' }),
		rid: integer('rid').notNull(),
		ticketId: text('ticket_id').notNull(),
		ticketNumber: text('ticket_number'),
		openedAt: text('opened_at'),
		closedAt: text('closed_at'),
		updatedAt: text('updated_at'),
		partySize: integer('party_size'),
		orderType: text('order_type'),
		orderItems: text('order_items', { mode: 'json' }).$type<
			Array<{
				id: string;
				name: string;
				price: number;
				quantity: number;
				sent_at: string;
				status: string;
				item: {
					id: string;
					name: string;
					price: number;
					categories: Array<{
						id: string;
						level: number;
						name: string;
						parent_menu_category?: {
							id: string;
							level: number;
							name: string;
						};
					}>;
				};
				modifiers: Array<{
					id: string;
					name: string;
					price: number;
					quantity: number;
				}>;
			}>
		>(),
		payments: text('payments', { mode: 'json' }).$type<
			Array<{
				id: string;
				type: string;
				amount: number;
				tip_amount: number;
				refund_amount: number;
			}>
		>(),
		subtotal: integer('subtotal'),
		tax: integer('tax'),
		tip: integer('tip'),
		total: integer('total'),
		currencyCode: text('currency_code').default('USD'),
		currencyDenominator: integer('currency_denominator').default(100),
		createdAt: timestamp('created_at')
	},
	(t) => [
		index('idx_pos_tickets_restaurant').on(t.restaurantId),
		index('idx_pos_tickets_ticket_id').on(t.ticketId)
	]
);

// ─── Reviews ─────────────────────────────────────────────────────────────────

export const reviews = sqliteTable(
	'reviews',
	{
		id: id(),
		restaurantId: text('restaurant_id')
			.notNull()
			.references(() => restaurants.id, { onDelete: 'cascade' }),
		rid: integer('rid').notNull(),
		reviewId: text('review_id').notNull().unique(),
		reservationId: integer('reservation_id'),
		gpId: text('gp_id'),
		countryCode: text('country_code'),
		customerNickname: text('customer_nickname'),
		locale: text('locale').default('en-US'),
		language: text('language').default('en'),
		metroId: integer('metro_id'),
		moderationState: integer('moderation_state'),
		simplifiedModerationState: text('simplified_moderation_state', {
			enum: ['PENDING', 'APPROVED', 'REJECTED']
		}),
		ratingOverall: integer('rating_overall'),
		ratingFood: integer('rating_food'),
		ratingService: integer('rating_service'),
		ratingAmbience: integer('rating_ambience'),
		ratingValue: integer('rating_value'),
		ratingNoise: integer('rating_noise'),
		recommended: integer('recommended', { mode: 'boolean' }),
		reviewText: text('review_text'),
		reviewTitle: text('review_title'),
		reviewType: integer('review_type').default(0),
		dinedDateTime: text('dined_date_time'),
		submissionDateTimeUtc: text('submission_date_time_utc'),
		lastModifiedDateTimeUtc: text('last_modified_date_time_utc'),
		categories: text('categories', { mode: 'json' }).$type<
			Array<{ Id: string; Label: string }>
		>(),
		photos: text('photos', { mode: 'json' }).$type<
			Array<{ Type: string; Key: string; Caption: string; ShowCaption: boolean }>
		>(),
		dinerInitials: text('diner_initials'),
		dinerMetroId: integer('diner_metro_id'),
		dinerIsVip: integer('diner_is_vip', { mode: 'boolean' }).default(false),
		helpfulnessUp: integer('helpfulness_up').default(0),
		helpfulnessDown: integer('helpfulness_down').default(0),
		featured: integer('featured', { mode: 'boolean' }).default(false),
		isDraft: integer('is_draft', { mode: 'boolean' }).default(false),
		source: text('source').default('internal'),
		createdAt: timestamp('created_at')
	},
	(t) => [
		index('idx_reviews_restaurant').on(t.restaurantId),
		index('idx_reviews_rid').on(t.rid)
	]
);

export const reviewReplies = sqliteTable('review_replies', {
	id: id(),
	reviewId: text('review_id')
		.notNull()
		.references(() => reviews.id, { onDelete: 'cascade' }),
	message: text('message').notNull(),
	from: text('from').default('Restaurant'),
	name: text('name'),
	isPublic: integer('is_public', { mode: 'boolean' }).default(true),
	replyingToReplyId: text('replying_to_reply_id'),
	replyToEmail: text('reply_to_email'),
	externalReplyState: text('external_reply_state'),
	createdAt: timestamp('created_at')
});

// ─── Menus ───────────────────────────────────────────────────────────────────

export const menus = sqliteTable(
	'menus',
	{
		id: id(),
		restaurantId: text('restaurant_id')
			.notNull()
			.references(() => restaurants.id, { onDelete: 'cascade' }),
		rid: integer('rid').notNull(),
		menuId: text('menu_id')
			.notNull()
			.$defaultFn(() => crypto.randomUUID()),
		name: text('name').notNull(),
		description: text('description'),
		currency: text('currency').default('USD'),
		ordinal: integer('ordinal').default(0),
		updatedAt: timestamp('updated_at'),
		createdAt: timestamp('created_at')
	},
	(t) => [index('idx_menus_restaurant').on(t.restaurantId)]
);

export const menuGroups = sqliteTable('menu_groups', {
	id: id(),
	menuId: text('menu_id')
		.notNull()
		.references(() => menus.id, { onDelete: 'cascade' }),
	groupId: text('group_id')
		.notNull()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	description: text('description'),
	ordinal: integer('ordinal').default(0)
});

export const menuItems = sqliteTable('menu_items', {
	id: id(),
	groupId: text('group_id')
		.notNull()
		.references(() => menuGroups.id, { onDelete: 'cascade' }),
	itemId: text('item_id')
		.notNull()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	description: text('description'),
	ordinal: integer('ordinal').default(0),
	priceAmount: integer('price_amount'),
	priceCurrency: text('price_currency').default('USD'),
	priceDenominator: integer('price_denominator').default(100),
	tags: text('tags', { mode: 'json' }).$type<string[]>(),
	modifierGroups: text('modifier_groups', { mode: 'json' }).$type<
		Array<{
			id: string;
			name: string;
			minQuantity: number;
			maxQuantity: number;
			modifiers: Array<{
				id: string;
				name: string;
				price: number;
			}>;
		}>
	>()
});

// ─── Private Dining Leads ────────────────────────────────────────────────────

export const privateDiningLeads = sqliteTable('private_dining_leads', {
	id: id(),
	restaurantId: text('restaurant_id')
		.notNull()
		.references(() => restaurants.id, { onDelete: 'cascade' }),
	rid: integer('rid').notNull(),
	firstName: text('first_name').notNull(),
	lastName: text('last_name').notNull(),
	email: text('email').notNull(),
	phoneNumber: text('phone_number'),
	eventDate: text('event_date'),
	eventTime: text('event_time'),
	partySize: integer('party_size'),
	eventType: text('event_type'),
	flexibleDate: integer('flexible_date', { mode: 'boolean' }).default(false),
	status: text('status', { enum: ['new', 'contacted', 'confirmed', 'declined'] })
		.notNull()
		.default('new'),
	createdAt: timestamp('created_at'),
	updatedAt: timestamp('updated_at')
});

// ─── Webhooks ────────────────────────────────────────────────────────────────

export const webhookSubscriptions = sqliteTable('webhook_subscriptions', {
	id: id(),
	restaurantId: text('restaurant_id')
		.notNull()
		.references(() => restaurants.id, { onDelete: 'cascade' }),
	partnerId: text('partner_id'),
	url: text('url').notNull(),
	events: text('events', { mode: 'json' }).$type<string[]>().notNull(),
	secret: text('secret'),
	active: integer('active', { mode: 'boolean' }).default(true),
	createdAt: timestamp('created_at'),
	updatedAt: timestamp('updated_at')
});

export const webhookDeliveries = sqliteTable(
	'webhook_deliveries',
	{
		id: id(),
		subscriptionId: text('subscription_id')
			.notNull()
			.references(() => webhookSubscriptions.id, { onDelete: 'cascade' }),
		event: text('event').notNull(),
		payload: text('payload', { mode: 'json' }),
		statusCode: integer('status_code'),
		responseBody: text('response_body'),
		attempts: integer('attempts').default(0),
		deliveredAt: text('delivered_at'),
		createdAt: timestamp('created_at')
	},
	(t) => [index('idx_webhook_deliveries_subscription').on(t.subscriptionId)]
);
