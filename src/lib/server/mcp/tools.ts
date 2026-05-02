// MCP Tool Definitions
// Each tool maps to a FreeRez API capability that AI agents can invoke.

export type McpToolDefinition = {
	name: string;
	description: string;
	inputSchema: {
		type: 'object';
		properties: Record<string, { type: string; description: string }>;
		required: string[];
	};
};

export const MCP_TOOLS: McpToolDefinition[] = [
	{
		name: 'check_availability',
		description:
			'Check available time slots for a restaurant on a given date for a specific party size',
		inputSchema: {
			type: 'object',
			properties: {
				rid: { type: 'number', description: 'Restaurant ID' },
				date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
				time: { type: 'string', description: 'Preferred time in HH:MM format (optional)' },
				party_size: { type: 'number', description: 'Number of guests' },
				forward_minutes: {
					type: 'number',
					description: 'How many minutes forward to search (default 180)'
				}
			},
			required: ['rid', 'date', 'party_size']
		}
	},
	{
		name: 'make_reservation',
		description: 'Create a new reservation at a restaurant',
		inputSchema: {
			type: 'object',
			properties: {
				rid: { type: 'number', description: 'Restaurant ID' },
				date_time: {
					type: 'string',
					description: 'Date and time in YYYY-MM-DDTHH:MM format'
				},
				party_size: { type: 'number', description: 'Number of guests' },
				first_name: { type: 'string', description: 'Guest first name' },
				last_name: { type: 'string', description: 'Guest last name' },
				email: { type: 'string', description: 'Guest email address' },
				phone: { type: 'string', description: 'Guest phone number' },
				special_request: { type: 'string', description: 'Any special requests or notes' }
			},
			required: ['rid', 'date_time', 'party_size', 'first_name', 'last_name']
		}
	},
	{
		name: 'cancel_reservation',
		description: 'Cancel an existing reservation',
		inputSchema: {
			type: 'object',
			properties: {
				rid: { type: 'number', description: 'Restaurant ID' },
				confirmation_number: {
					type: 'number',
					description: 'Reservation confirmation number'
				}
			},
			required: ['rid', 'confirmation_number']
		}
	},
	{
		name: 'modify_reservation',
		description:
			'Modify an existing reservation (change time, party size, or special request)',
		inputSchema: {
			type: 'object',
			properties: {
				rid: { type: 'number', description: 'Restaurant ID' },
				confirmation_number: {
					type: 'number',
					description: 'Reservation confirmation number'
				},
				date_time: { type: 'string', description: 'New date/time (YYYY-MM-DDTHH:MM)' },
				party_size: { type: 'number', description: 'New party size' },
				special_request: { type: 'string', description: 'Updated special request' }
			},
			required: ['rid', 'confirmation_number']
		}
	},
	{
		name: 'search_reservations',
		description: 'Search upcoming reservations by guest name, phone, or date',
		inputSchema: {
			type: 'object',
			properties: {
				rid: { type: 'number', description: 'Restaurant ID' },
				guest_name: { type: 'string', description: 'Guest name to search' },
				phone: { type: 'string', description: 'Phone number to search' },
				date: { type: 'string', description: 'Date to filter (YYYY-MM-DD)' }
			},
			required: ['rid']
		}
	},
	{
		name: 'get_restaurant_info',
		description:
			'Get information about a restaurant including hours, cuisine, and contact details',
		inputSchema: {
			type: 'object',
			properties: {
				rid: { type: 'number', description: 'Restaurant ID' }
			},
			required: ['rid']
		}
	},
	{
		name: 'list_today_reservations',
		description:
			'List all reservations for today (or a specific date) at a restaurant',
		inputSchema: {
			type: 'object',
			properties: {
				rid: { type: 'number', description: 'Restaurant ID' },
				date: {
					type: 'string',
					description: 'Date to list (YYYY-MM-DD, defaults to today)'
				}
			},
			required: ['rid']
		}
	},
	{
		name: 'get_guest_profile',
		description:
			"Look up a guest's profile including visit history, preferences, and tags",
		inputSchema: {
			type: 'object',
			properties: {
				rid: { type: 'number', description: 'Restaurant ID' },
				guest_name: { type: 'string', description: 'Guest name to look up' },
				email: { type: 'string', description: 'Guest email' },
				phone: { type: 'string', description: 'Guest phone number' }
			},
			required: ['rid']
		}
	}
];
