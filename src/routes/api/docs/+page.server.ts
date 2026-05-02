import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	return {
		baseUrl: url.origin,
		groups: [
			{
				name: 'Authentication',
				endpoints: ['GET/POST /api/v1/oauth/token']
			},
			{
				name: 'Restaurants',
				endpoints: [
					'GET /api/v1/restaurants',
					'GET/POST /api/v1/restaurants/{rid}',
					'GET /api/v1/restaurants/{rid}/availability',
					'GET /api/v1/restaurants/{rid}/availability/metadata',
					'GET/POST /api/v1/restaurants/{rid}/experiences'
				]
			},
			{
				name: 'Reservations',
				endpoints: [
					'POST /api/v1/restaurants/{rid}/slot-locks',
					'DELETE /api/v1/restaurants/{rid}/slot-locks/{token}',
					'GET/POST /api/v1/restaurants/{rid}/reservations',
					'GET/PUT /api/v1/restaurants/{rid}/reservations/{id}',
					'POST /api/v1/restaurants/{rid}/reservations/experiences/total',
					'GET /api/v1/restaurants/{rid}/policies/booking',
					'GET /api/v1/restaurants/{rid}/policies/cancellation/{id}'
				]
			},
			{
				name: 'In-House (Restaurant-Side)',
				endpoints: [
					'GET /api/v1/restaurants/{rid}/inhouse/availability',
					'GET/POST /api/v1/restaurants/{rid}/inhouse/experiences',
					'POST /api/v1/restaurants/{rid}/inhouse/slot-locks',
					'POST /api/v1/restaurants/{rid}/inhouse/reservations',
					'POST /api/v1/restaurants/{rid}/inhouse/reservations/search',
					'PUT/DELETE /api/v1/restaurants/{rid}/inhouse/reservations/{id}'
				]
			},
			{
				name: 'Guest CRM',
				endpoints: [
					'GET/POST /api/v1/restaurants/{rid}/guests',
					'PUT /api/v1/restaurants/{rid}/guests/{id}/tags',
					'PUT /api/v1/restaurants/{rid}/guests/{id}/loyalties',
					'PUT /api/v1/restaurants/{rid}/guests/{id}/insights',
					'PUT /api/v1/restaurants/{rid}/guests/{id}/properties',
					'GET/PUT/DELETE /api/v1/restaurants/{rid}/guests/{id}/photos',
					'GET /api/v1/restaurants/{rid}/tags',
					'PUT/DELETE /api/v1/restaurants/{rid}/tags/{id}'
				]
			},
			{
				name: 'Content',
				endpoints: [
					'GET/POST /api/v1/restaurants/{rid}/menus',
					'GET /api/v1/restaurants/{rid}/menus/{id}',
					'GET /api/v1/restaurants/{rid}/reviews',
					'GET /api/v1/restaurants/{rid}/reviews/summary',
					'POST /api/v1/restaurants/{rid}/reviews/{id}/replies'
				]
			},
			{
				name: 'POS',
				endpoints: [
					'GET/PATCH /api/v1/restaurants/{rid}/pos',
					'GET/POST /api/v1/restaurants/{rid}/pos/tickets'
				]
			},
			{
				name: 'Other',
				endpoints: [
					'POST /api/v1/restaurants/{rid}/private-dining/leads',
					'GET/POST /api/v1/restaurants/{rid}/webhooks',
					'GET/PUT/DELETE /api/v1/restaurants/{rid}/webhooks/{id}'
				]
			},
			{
				name: 'Admin (Platform Operators)',
				endpoints: [
					'GET/POST /api/v1/admin/tenants',
					'GET/PUT/DELETE /api/v1/admin/tenants/{id}',
					'GET/POST /api/v1/admin/tenants/{id}/restaurants',
					'GET/POST /api/v1/admin/clients',
					'GET/PUT/DELETE /api/v1/admin/clients/{id}',
					'POST /api/v1/admin/maintenance'
				]
			}
		]
	};
};
