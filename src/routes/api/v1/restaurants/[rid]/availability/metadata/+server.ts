import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { restaurants, diningAreas } from '$db/schema';
import { getAuthContext, apiError, apiSuccess, requireAuthorizedRid } from '$api/helpers';

export const GET: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;
	const auth = getAuthContext(event)!;

	const db = event.locals.db;

	// Resolve restaurant
	const rest = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);

	if (rest.length === 0) return apiError('Restaurant not found', 404);
	const restaurant = rest[0];

	// Get dining areas
	const areas = await db
		.select()
		.from(diningAreas)
		.where(and(eq(diningAreas.restaurantId, restaurant.id), eq(diningAreas.active, true)));

	// Collect unique environments and attributes
	const environmentsSet = new Set<string>();
	const attributesSet = new Set<string>();

	for (const area of areas) {
		if (area.environment) environmentsSet.add(area.environment);
		if (area.attributes) {
			for (const attr of area.attributes as string[]) {
				attributesSet.add(attr);
			}
		}
	}

	// Note: OpenTable spec uses "enviroments" (typo) - match exactly
	const diningAreasList = areas.map((area) => {
		const entry: Record<string, unknown> = {
			id: area.areaId,
			name: area.name,
			description: area.description ?? area.name
		};
		if (area.environment) {
			entry.environment = area.environment;
		}
		return entry;
	});

	return apiSuccess({
		data: {
			enviroments: Array.from(environmentsSet),
			attributes: Array.from(attributesSet),
			dining_areas: diningAreasList
		}
	});
};
