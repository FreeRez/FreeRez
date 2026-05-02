# FreeRez

Open-source restaurant reservation platform. OpenTable-compatible API with zero cover fees.

## Tech Stack

- **Framework**: SvelteKit with Svelte 5 (runes mode)
- **Database**: Drizzle ORM with SQLite/D1
- **Deployment**: Cloudflare Workers + D1 (hosted) or Docker + SQLite (self-hosted)
- **Auth**: BetterAuth (UI sessions) + OAuth 2.0 client credentials (API)
- **Styling**: Tailwind CSS v4 + shadcn-svelte + Lucide icons
- **TypeScript**: Strict mode, zero errors tolerance

## Architecture

```
Control Plane DB          Tenant DB (one per org)
├─ tenants                ├─ restaurants
├─ tenant_databases       ├─ reservations
├─ tenant_restaurants     ├─ guests
├─ api_clients            ├─ tables, shifts
├─ api_tokens             ├─ menus, reviews
├─ tenant_members         ├─ experiences
└─ audit_log              ├─ webhooks
                          └─ pos_tickets
```

Request flow: Bearer token → control plane lookup → tenant DB resolution → endpoint execution.

## Key Directories

- `src/routes/api/v1/` — All API endpoints
- `src/routes/api/v1/restaurants/[rid]/` — Restaurant-scoped consumer endpoints
- `src/routes/api/v1/restaurants/[rid]/inhouse/` — Restaurant-side (host stand) endpoints
- `src/routes/api/v1/admin/` — Platform admin endpoints (X-Admin-Key auth)
- `src/routes/api/v1/mcp/` — MCP server for AI agents
- `src/lib/server/db/` — Tenant database schema + adapters
- `src/lib/server/control-plane/` — Control plane schema + tenant resolution
- `src/lib/server/api/` — Shared helpers, availability engine, webhook dispatcher
- `src/lib/server/webhooks/` — Webhook delivery adapters (DO + local)
- `src/lib/server/mcp/` — MCP tool definitions and handlers
- `src/lib/server/notifications/` — Email/SMS adapter layer
- `src/lib/server/logger.ts` — Structured JSON logger
- `static/openapi.json` — OpenAPI 3.1 spec (Postman-importable)

## Commands

```bash
npm run dev          # Local dev server
npm run build        # Build for Cloudflare
npm run check        # TypeScript type checking
npm run db:generate  # Generate Drizzle migration
npx wrangler deploy  # Deploy to Cloudflare
```

## Conventions

- All API endpoints use `requireAuthorizedRid()` for rid validation + authorization
- Use `parseJsonBody()` for POST/PUT body parsing (includes size limits)
- Use `getAuthContext()` to access the authenticated client's tenant/tier/scope
- Webhook dispatches use fire-and-forget pattern: `dispatchWebhook(...).catch(() => {})`
- Response format: `{ errors: [{ message, code?, field? }], requestid }` for errors
- Pagination: `{ hasNextPage, nextPageUrl, offset, limit, items }` for lists
- Data tiers: copper (basic), gold (+ PII), platinum (+ marketing/campaign data)
- Consumer vs inhouse booking: separate path namespaces, never magic headers
- Idempotency: POST/PUT/PATCH with `X-Request-Id` header are deduplicated (24hr TTL)
- Notifications: `event.locals.notifications` provides email/sms adapters (configure via env vars)
- Logging: use `log('info', 'event.name', { ...data })` from `$lib/server/logger`

## Testing

```bash
# Get OAuth token
curl -H "Authorization: Basic $(echo -n 'client_id:secret' | base64)" \
  "$BASE/api/v1/oauth/token?grant_type=client_credentials"

# Admin endpoints use X-Admin-Key header
curl -H "X-Admin-Key: $ADMIN_KEY" "$BASE/api/v1/admin/tenants"
```

## Environment Variables

- `ADMIN_API_KEY` — Platform admin secret (set via `wrangler secret put`)
- `DB` — D1 binding for default tenant database
- `CONTROL_PLANE_DB` — D1 binding for control plane database
- `WEBHOOK_DO` — Durable Object namespace for webhook delivery (optional)
- `EMAIL_API_URL` — HTTP email API endpoint (Resend, Postmark, SendGrid)
- `EMAIL_API_KEY` — Email service API key
- `EMAIL_FROM` — Default sender email address
- `TWILIO_ACCOUNT_SID` — Twilio account SID (for SMS)
- `TWILIO_AUTH_TOKEN` — Twilio auth token
- `TWILIO_FROM_NUMBER` — Twilio sender phone number
- `SMS_API_URL` — Generic SMS API endpoint (Telnyx, Bandwidth)
- `SMS_API_KEY` — SMS service API key
- `SMS_FROM_NUMBER` — SMS sender number
