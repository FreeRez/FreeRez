# FreeRez UI Sitemap

## 1. Diner Booking Widget (Public / Embeddable)

### 1.1 `/book/{restaurant-slug}`  —  Restaurant Landing
- Restaurant name, cuisine, price band
- Profile photo (hero image)
- Address, phone, website link
- Opening hours (formatted by day)
- Description
- Tags (Cocktails, Fireplace, Outdoor Dining, etc.)
- Average rating (stars), total review count
- "Reserve a Table" CTA button
- **Action:** Navigate to availability picker

### 1.2 `/book/{restaurant-slug}/availability`  —  Date/Time Picker
- Date selector (calendar, defaults to today)
- Party size selector (1–20 dropdown)
- Time preference (Morning / Lunch / Dinner toggle or specific time)
- Available time slots grid (15-min intervals, grouped by dining area)
  - Each slot shows: time, dining area name, environment (Indoor/Outdoor)
  - Slots with experiences show experience badge
  - Slots with cancellation policy show deposit indicator
- "No availability" message with suggested alternate dates
- **Action:** Select a slot → creates slot lock → navigate to details

### 1.3 `/book/{restaurant-slug}/details`  —  Guest Details Form
- First name (required)
- Last name (required)
- Email address (required)
- Phone number with country code selector (required)
- Special requests (textarea, optional)
- Experience selector (if available for this slot)
  - Experience name, description, price per person
  - Price type selector (Adult/Child quantities)
  - Add-ons checkboxes with quantities
  - Running total display
- Restaurant email marketing opt-in checkbox
- SMS notifications opt-in checkbox
- Booking policy text (displayed from API)
- Cancellation policy text (if deposit required)
- 5-minute countdown timer (slot lock expiry)
- **Action:** Submit → create reservation

### 1.4 `/book/{restaurant-slug}/confirmed`  —  Confirmation
- Confirmation number (large, prominent)
- Restaurant name
- Date and time
- Party size
- Special request (if any)
- Experience details (if any, with total)
- "Add to Calendar" button (iCal download)
- "Manage Reservation" link
- Restaurant address with map link
- Restaurant phone number

### 1.5 `/book/{restaurant-slug}/manage/{confirmation}`  —  Manage Reservation
- Current reservation details (date, time, party, notes)
- Reservation status badge (Confirmed, Seated, Completed, Cancelled)
- "Modify Reservation" button → opens modify flow
  - New date/time picker (same as 1.2)
  - New party size
  - Updated special request
- "Cancel Reservation" button → confirmation modal
  - Cancellation policy reminder (if deposit)
  - "Yes, cancel" / "Keep reservation" buttons
- **Action:** Modify → updates reservation; Cancel → cancels

---

## 2. Restaurant Dashboard (Authenticated / Operators)

### 2.0 `/dashboard`  —  Overview / Today View
- Today's date, restaurant name
- Quick stats cards:
  - Total covers today
  - Total reservations today (by status: confirmed, seated, completed, no-show)
  - Current occupancy (seated / total capacity)
  - Upcoming in next hour (count)
- Next 5 upcoming reservations (mini-list)
  - Time, guest name, party size, status, special request preview
- Recent activity feed (last 10 events)
  - New booking, cancellation, modification, review posted
- Quick actions: "Walk-in" button, "Block table" button

### 2.1 `/dashboard/reservations`  —  Reservation List
- Date range filter (today, tomorrow, this week, custom range)
- Status filter tabs (All, Confirmed, Seated, Completed, Cancelled, No-Show)
- Search bar (guest name, phone, confirmation number)
- Sortable table:
  - Time
  - Guest name (first + last)
  - Party size
  - Table number(s)
  - Status (badge)
  - Origin (Web, Phone, Walk-in, Partner)
  - Server assigned
  - Special request (truncated)
  - Actions (seat, complete, no-show, edit, cancel)
- Pagination (offset/limit)
- "New Reservation" button → opens creation form
- Export button (CSV)

### 2.1.1 `/dashboard/reservations/new`  —  Create Reservation (Staff Side)
- Guest search (by name, phone, email — autocomplete from CRM)
  - Or "New Guest" quick-create inline
- Date picker
- Time picker (shows real-time availability)
- Party size
- Dining area / table preference
- Special request
- Server assignment dropdown
- Visit tags (multi-select: birthday, anniversary, VIP, etc.)
- SMS notification opt-in toggle
- Payment/deposit waiver toggle (with reason field)
- **Action:** Create → calls inhouse reservation API

### 2.1.2 `/dashboard/reservations/{id}`  —  Reservation Detail
- Full reservation data:
  - Confirmation number, status, origin
  - Scheduled date/time, party size
  - Dining area, environment, table number(s)
  - Guest name, email, phone (linked to CRM profile)
  - Special request
  - Server assigned
  - Visit tags
  - Created date, last modified date
- Experience details (if attached):
  - Name, description, prices, add-ons, total
- POS data (if linked):
  - Check IDs, subtotal, tax, tip, total spend
  - Order items list
- Deposit/payment status
- Timeline (created → confirmed → seated → completed)
- Actions: Edit, Seat, Complete, No-Show, Cancel
- Notes field (staff-only, internal)

### 2.2 `/dashboard/floor-plan`  —  Live Floor Plan
- SVG/Canvas interactive floor plan
- Tables rendered by position (x, y coordinates)
  - Shape: square, round, rectangle
  - Color-coded by status:
    - Green = Available
    - Blue = Reserved (upcoming)
    - Red = Seated (occupied)
    - Yellow = Dirty (needs clearing)
    - Gray = Blocked
  - Table number label
  - Current party info on hover (guest name, party size, seated duration)
- Dining area tabs/filter (Main, Garden, VIP, etc.)
- Legend
- Time scrubber (view future state at any time)
- Click table → shows reservation detail or "Seat walk-in" action
- Drag to reassign tables
- Real-time updates (polling or WebSocket)

### 2.3 `/dashboard/guests`  —  Guest CRM
- Search bar (name, email, phone)
- Filters: tags, visit frequency, date range
- Guest list table:
  - Name
  - Email
  - Phone
  - Tags (badges)
  - Total visits
  - Last visit date
  - Email opt-in status
  - Notes preview
- Click row → guest detail page
- "Add Guest" button
- Export button (CSV)

### 2.3.1 `/dashboard/guests/{id}`  —  Guest Profile
- Header: name, photo (if uploaded), VIP badge
- Contact info: email, phone (with country code), company
- Marketing preferences: email opt-in, SMS opt-in
- Tags section (add/remove tags from restaurant's tag library)
- Notes sections:
  - General notes
  - Special relationship notes
  - Food & drink preferences
  - Seating preferences
- Loyalty program info:
  - Program name, tier, points balance
  - Custom flex fields
- Hotel/property details (if hotel integration):
  - Property name, room number, check-in/out dates
- Insights:
  - Average check size
  - Visit frequency
  - Custom insights
- Visit history table:
  - Date, time, party size, table, status, server, spend
- Birthday / anniversary dates
- **Actions:** Edit profile, upload photo, add tag, add note

### 2.4 `/dashboard/availability`  —  Availability & Shifts
- Weekly calendar view (Mon–Sun)
- Shift blocks (visual timeline per day):
  - Shift name (Brunch, Lunch, Dinner)
  - Start time, end time
  - Slot interval (15 min, 30 min)
  - Max covers per slot
  - Color coding by shift type
- Click shift → edit modal:
  - Name, day(s) of week, start/end time
  - Slot interval minutes
  - Max covers per slot
  - Active toggle
- "Add Shift" button
- Date overrides (holidays, special events — block or modify)
- Table inventory summary (total capacity by dining area)

### 2.5 `/dashboard/tables`  —  Table Management
- Dining area tabs
- Table list per area:
  - Table number
  - Min covers, max covers
  - Shape (square, round, rectangle)
  - Position (x, y for floor plan)
  - Status
  - Active toggle
- "Add Table" button
- "Add Dining Area" button
- Dining area settings:
  - Name, description, environment (Indoor/Outdoor)
  - Attributes (default, highTop, bar, counter)

### 2.6 `/dashboard/menus`  —  Menu Management
- Menu list (ordinal-sorted):
  - Name, description, currency
  - Group count, item count
  - Last updated
- Click menu → menu editor:
  - Menu name, description, currency, ordinal
  - Groups (drag to reorder):
    - Group name, description, ordinal
    - Items within group (drag to reorder):
      - Item name, description, price, tags
      - Modifier groups
  - "Add Group" / "Add Item" buttons
- "Create Menu" button
- "Import Menu" (JSON upload matching API format)

### 2.7 `/dashboard/reviews`  —  Reviews & Ratings
- Summary cards:
  - Overall rating (avg), total review count
  - Category averages: Food, Service, Ambience, Value
  - Noise level average
  - Recommendation rate (% yes)
- Rating distribution histogram (1–5 stars)
- Category tags distribution (Romantic, Kid-friendly, Brunch, etc.)
- Review list (newest first):
  - Reviewer nickname, initials
  - Overall rating (stars)
  - Sub-ratings (food, service, ambience, value)
  - Review text
  - Dined date
  - Categories/tags
  - Photos (if any)
  - Helpfulness score (up/down)
  - Moderation status badge
  - Restaurant reply (if exists) or "Reply" button
- Reply form:
  - Message textarea
  - Reply as (name)
  - Public toggle
  - Reply-to email

### 2.8 `/dashboard/experiences`  —  Experience Management
- Experience list:
  - Name, description
  - Price range (from lowest to highest tier)
  - Bookable status
  - Prepaid toggle
  - Active toggle
- Click → experience editor:
  - Name, description, currency
  - Bookable, prepaid, version
  - Price tiers (Adult, Child, etc.):
    - Title, description, price, all-inclusive toggle
  - Add-on groups:
    - Group name, description, max per reservation
    - Add-on items: name, description, price, max quantity
  - Service charges: label, rate (numerator/denominator), mandatory, taxable
  - Taxes: label, percentage
  - Gratuity settings: mandatory tip, taxable tip
- "Create Experience" button

### 2.9 `/dashboard/pos`  —  POS Integration
- Connection status (online/offline, last heartbeat)
- POS type, source location ID
- Recent tickets list:
  - Ticket number, opened at, party size, order type
  - Items ordered (expandable)
  - Subtotal, tax, tip, total
  - Payment method(s)
- Ticket detail view (click to expand)
- Configuration: POS type, location ID

### 2.10 `/dashboard/webhooks`  —  Webhook Management
- Subscription list:
  - URL, events subscribed, active status
  - Last delivery status, last delivery time
- Click → subscription detail:
  - URL, secret (masked)
  - Events (checkboxes)
  - Active toggle
  - Recent deliveries log:
    - Event, status code, response preview, timestamp, attempts
- "Add Webhook" button
- Test webhook button (sends a test payload)

### 2.11 `/dashboard/settings`  —  Restaurant Settings
- **Profile tab:**
  - Restaurant name, description
  - Cuisine, dining style, dress code
  - Executive chef, cross street
  - Address (street, city, state, zip, country)
  - Phone, website
  - Timezone selector
  - Price band
  - Profile photo upload
  - Gallery images upload
  - Tags (multi-select)
  - Opening hours editor (per day of week)
  - Private event details, catering details
- **Policies tab:**
  - Booking policies list (add/edit/delete)
    - Type (General, Covid, Custom)
    - Message (rich text)
    - Language
  - Cancellation policies list (add/edit/delete)
    - Type (None, Deposit, CreditCard)
    - Deposit amount, currency, type (per guest / per reservation)
    - Cutoff type, cutoff value
- **Staff tab:**
  - Staff list: name, email, role (owner, manager, host, server)
  - Invite staff member (email + role)
  - Remove staff member
- **Integrations tab:**
  - Partner integrations list
  - API client credentials (view client ID, rotate secret)
  - Connected services status
- **Private Dining tab:**
  - Lead inbox (list of inquiries)
    - Name, email, phone, event date, party size, event type
    - Status (new, contacted, confirmed, declined)
    - Click → detail view with all fields
  - Lead form settings

---

## 3. Admin Panel (Platform Operators)

### 3.0 `/admin`  —  Dashboard
- Total tenants (active, suspended, cancelled)
- Total restaurants across all tenants
- Total API clients
- System health status (from /health endpoint)
- Recent tenant activity

### 3.1 `/admin/tenants`  —  Tenant Management
- Tenant list table:
  - Name, slug, email
  - Plan (free, starter, professional, enterprise)
  - Status (active, suspended, cancelled)
  - Restaurant count
  - Member count
  - Created date
- Search bar
- "Create Tenant" button → form:
  - Name, slug, email, plan, max restaurants
- Click row → tenant detail

### 3.1.1 `/admin/tenants/{id}`  —  Tenant Detail
- Tenant info: name, slug, email, plan, status, max restaurants
- Edit button (name, plan, status, max restaurants)
- Database info: D1 database ID, region, status, schema version
- Members list: email, role, invite status
- Restaurants list: rid, name, active status
  - "Register Restaurant" button
- API clients for this tenant:
  - Client ID, name, tier, scope, active
  - "Create Client" button
- Danger zone: suspend, cancel tenant

### 3.2 `/admin/clients`  —  API Client Management
- Client list table:
  - Client ID (fr_xxx), name, tenant name
  - Tier, scope, active status
  - Allowed RIDs (or "all")
  - Created date
- "Create Client" button → form:
  - Tenant selector
  - Name, tier, scope
  - Allowed RIDs (optional, comma-separated)
  - → Shows generated client_id + client_secret (one-time display)
- Click row → client detail (edit tier, scope, allowedRids, deactivate)

### 3.3 `/admin/maintenance`  —  System Maintenance
- "Run Cleanup" button → calls maintenance endpoint
  - Shows results: expired tokens, expired slot locks, expired idempotency keys
- Last cleanup timestamp
- Database sizes (control plane, tenant DBs)
- Health check results (control plane DB, tenant DB latencies)

---

## 4. Auth Pages

### 4.1 `/login`
- Email field
- Password field
- "Sign in" button
- "Forgot password" link
- "Create account" link

### 4.2 `/register`
- Name field
- Email field
- Password field (with strength indicator)
- Confirm password field
- "Create account" button
- Terms of service checkbox

### 4.3 `/forgot-password`
- Email field
- "Send reset link" button

### 4.4 `/reset-password`
- New password field
- Confirm password field
- "Reset password" button

---

## 5. Marketing / Public Pages

### 5.1 `/` — Landing Page
- Hero: "Open-source restaurant reservations. No cover fees."
- Feature highlights (API-first, MCP, self-hostable)
- Pricing section (Free self-hosted / Starter / Pro / Enterprise)
- "Get Started" CTA
- "View API Docs" link

### 5.2 `/pricing`
- Plan comparison table
- Self-hosted (free) vs hosted tiers
- Feature matrix

### 5.3 `/api/docs` — API Documentation (already exists)
- OpenAPI spec viewer
- Endpoint listing by group

### 5.4 `/about`
- Mission statement
- Open source commitment
