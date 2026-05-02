/**
 * OpenTable API compatibility layer.
 * Rewrites legacy OpenTable API paths to FreeRez's unified /api/v1 structure.
 * Enable by setting OPENTABLE_COMPAT=true in environment.
 */

type RewriteRule = {
	pattern: RegExp;
	rewrite: (match: RegExpMatchArray) => { path: string; headers?: Record<string, string> };
};

const rules: RewriteRule[] = [
	// OAuth
	{
		pattern: /^\/api\/v2\/oauth\/token$/,
		rewrite: () => ({ path: '/api/v1/oauth/token' })
	},

	// Consumer Booking - Availability
	{
		pattern: /^\/v2\/availability\/(\d+)$/,
		rewrite: (m) => ({ path: `/api/v1/restaurants/${m[1]}/availability` })
	},
	{
		pattern: /^\/v2\/availability-metadata\/(\d+)$/,
		rewrite: (m) => ({ path: `/api/v1/restaurants/${m[1]}/availability/metadata` })
	},

	// Consumer Booking - Experiences
	{
		pattern: /^\/v2\/experiences\/(\d+)\/active$/,
		rewrite: (m) => ({ path: `/api/v1/restaurants/${m[1]}/experiences` })
	},

	// Consumer Booking - Slot Locks
	{
		pattern: /^\/v2\/booking\/(\d+)\/slot_locks$/,
		rewrite: (m) => ({ path: `/api/v1/restaurants/${m[1]}/slot-locks` })
	},
	{
		pattern: /^\/v2\/booking\/(\d+)\/slot_locks\/(.+)$/,
		rewrite: (m) => ({ path: `/api/v1/restaurants/${m[1]}/slot-locks/${m[2]}` })
	},

	// Consumer Booking - Reservations
	{
		pattern: /^\/v2\/booking\/(\d+)\/reservations\/experiences\/total$/,
		rewrite: (m) => ({ path: `/api/v1/restaurants/${m[1]}/reservations/experiences/total` })
	},
	{
		pattern: /^\/v2\/booking\/(\d+)\/reservations\/(.+)$/,
		rewrite: (m) => ({ path: `/api/v1/restaurants/${m[1]}/reservations/${m[2]}` })
	},
	{
		pattern: /^\/v2\/booking\/(\d+)\/reservations$/,
		rewrite: (m) => ({ path: `/api/v1/restaurants/${m[1]}/reservations` })
	},

	// Consumer Booking - Policies
	{
		pattern: /^\/v2\/booking-policies\/(\d+)\/([^/]+)\/([^/]+)\/([^/]+)$/,
		rewrite: (m) => ({
			path: `/api/v1/restaurants/${m[1]}/policies/booking?date=${m[2]}&time=${m[3]}&party_size=${m[4]}`
		})
	},
	{
		pattern: /^\/v2\/cancellation-policies\/(\d+)\/(.+)$/,
		rewrite: (m) => ({ path: `/api/v1/restaurants/${m[1]}/policies/cancellation/${m[2]}` })
	},

	// In-House Booking - rewrites with X-Booking-Context header
	{
		pattern: /^\/inhouse\/v1\/availability\/(\d+)$/,
		rewrite: (m) => ({
			path: `/api/v1/restaurants/${m[1]}/availability`,
			headers: { 'X-Booking-Context': 'inhouse' }
		})
	},
	{
		pattern: /^\/inhouse\/v1\/booking\/experiences\/(\d+)$/,
		rewrite: (m) => ({
			path: `/api/v1/restaurants/${m[1]}/experiences`,
			headers: { 'X-Booking-Context': 'inhouse' }
		})
	},
	{
		pattern: /^\/inhouse\/v1\/booking\/(\d+)\/locks$/,
		rewrite: (m) => ({
			path: `/api/v1/restaurants/${m[1]}/slot-locks`,
			headers: { 'X-Booking-Context': 'inhouse' }
		})
	},
	{
		pattern: /^\/inhouse\/v1\/booking\/(\d+)\/reservations\/search$/,
		rewrite: (m) => ({
			path: `/api/v1/restaurants/${m[1]}/reservations/search`,
			headers: { 'X-Booking-Context': 'inhouse' }
		})
	},
	{
		pattern: /^\/inhouse\/v1\/booking\/(\d+)\/reservations\/(.+)$/,
		rewrite: (m) => ({
			path: `/api/v1/restaurants/${m[1]}/reservations/${m[2]}`,
			headers: { 'X-Booking-Context': 'inhouse' }
		})
	},
	{
		pattern: /^\/inhouse\/v1\/booking\/(\d+)\/reservations$/,
		rewrite: (m) => ({
			path: `/api/v1/restaurants/${m[1]}/reservations`,
			headers: { 'X-Booking-Context': 'inhouse' }
		})
	},

	// CRM APIs - strip partner_id from path, use auth token's partnerId
	{
		pattern: /^\/api\/v3\/external\/partners\/[^/]+\/restaurants\/(\d+)\/guests\/([^/]+)\/(loyalties|tags|properties|insights|photos)$/,
		rewrite: (m) => ({ path: `/api/v1/restaurants/${m[1]}/guests/${m[2]}/${m[3]}` })
	},
	{
		pattern: /^\/api\/v3\/external\/partners\/[^/]+\/restaurants\/(\d+)\/guests\/([^/]+)$/,
		rewrite: (m) => ({ path: `/api/v1/restaurants/${m[1]}/guests/${m[2]}` })
	},
	{
		pattern: /^\/api\/v3\/external\/partners\/[^/]+\/restaurants\/(\d+)\/guests$/,
		rewrite: (m) => ({ path: `/api/v1/restaurants/${m[1]}/guests` })
	},
	{
		pattern: /^\/api\/v3\/external\/partners\/[^/]+\/restaurants\/(\d+)\/tags\/(.+)$/,
		rewrite: (m) => ({ path: `/api/v1/restaurants/${m[1]}/tags/${m[2]}` })
	},
	{
		pattern: /^\/api\/v3\/external\/partners\/[^/]+\/restaurants\/(\d+)\/tags$/,
		rewrite: (m) => ({ path: `/api/v1/restaurants/${m[1]}/tags` })
	},

	// Sync APIs
	{
		pattern: /^\/sync\/v2\/reservations$/,
		rewrite: () => ({ path: '/api/v1/restaurants/0/reservations' })
	},
	{
		pattern: /^\/sync\/v2\/guests$/,
		rewrite: () => ({ path: '/api/v1/restaurants/0/guests' })
	},
	{
		pattern: /^\/sync\/v2\/pos-data$/,
		rewrite: () => ({ path: '/api/v1/restaurants/0/pos/tickets' })
	},
	{
		pattern: /^\/sync\/directory$/,
		rewrite: () => ({ path: '/api/v1/restaurants' })
	},

	// Menus
	{
		pattern: /^\/v1\/menus\/rid\/(\d+)\/menu\/(.+)$/,
		rewrite: (m) => ({ path: `/api/v1/restaurants/${m[1]}/menus/${m[2]}` })
	},
	{
		pattern: /^\/v1\/menus\/rid\/(\d+)$/,
		rewrite: (m) => ({ path: `/api/v1/restaurants/${m[1]}/menus` })
	},
	{
		pattern: /^\/v1\/partnermenu\/[^/]+\/location\/(\d+)\/menus$/,
		rewrite: (m) => ({ path: `/api/v1/restaurants/${m[1]}/menus` })
	},

	// POS
	{
		pattern: /^\/pos\/locations\/(\d+)\/tickets$/,
		rewrite: (m) => ({ path: `/api/v1/restaurants/${m[1]}/pos/tickets` })
	},
	{
		pattern: /^\/pos\/restaurants\/(\d+)\/location\/status$/,
		rewrite: (m) => ({ path: `/api/v1/restaurants/${m[1]}/pos` })
	},
	{
		pattern: /^\/pos\/restaurants$/,
		rewrite: () => ({ path: '/api/v1/restaurants' })
	},
	{
		pattern: /^\/v1\/pos\/restaurants\/(\d+)\/tickets$/,
		rewrite: (m) => ({ path: `/api/v1/restaurants/${m[1]}/pos/tickets` })
	},

	// Reviews
	{
		pattern: /^\/v1\/partnerreviews\/allreviews$/,
		rewrite: () => ({ path: '/api/v1/restaurants/0/reviews' })
	},
	{
		pattern: /^\/v1\/partnerreviews\/restaurantreviewsummary$/,
		rewrite: () => ({ path: '/api/v1/restaurants/0/reviews/summary' })
	},
	{
		pattern: /^\/v1\/partnerreviews\/reviewreplies\/(.+)$/,
		rewrite: (m) => ({ path: `/api/v1/restaurants/0/reviews/${m[1]}/replies` })
	},

	// Profile Content
	{
		pattern: /^\/v2\/partnerrestaurants\/rid\/(\d+)$/,
		rewrite: (m) => ({ path: `/api/v1/restaurants/${m[1]}` })
	},

	// Private Dining
	{
		pattern: /^\/v1\/privatedining\/restaurant\/(\d+)\/leads$/,
		rewrite: (m) => ({ path: `/api/v1/restaurants/${m[1]}/private-dining/leads` })
	},

	// Webhooks
	{
		pattern: /^\/v1\/webhooks\/(.+)$/,
		rewrite: (m) => ({ path: `/api/v1/restaurants/0/webhooks/${m[1]}` })
	},
	{
		pattern: /^\/v1\/webhooks$/,
		rewrite: () => ({ path: '/api/v1/restaurants/0/webhooks' })
	}
];

export function rewriteOpenTablePath(pathname: string): {
	path: string;
	headers: Record<string, string>;
} | null {
	for (const rule of rules) {
		const match = pathname.match(rule.pattern);
		if (match) {
			const result = rule.rewrite(match);
			return {
				path: result.path,
				headers: result.headers ?? {}
			};
		}
	}
	return null;
}
