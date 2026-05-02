import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { restaurants } from '$db/schema';
import { getAuthContext, apiError, apiSuccess, requireAuthorizedRid, getRequestId, parseJsonBody } from '$api/helpers';

interface ProfileUpdateBody {
	id?: string;
	name?: string;
	primaryCuisine?: string;
	phone?: string;
	currency?: string;
	locale?: string;
	website?: string;
	timeZone?: string;
	priceBandId?: number;
	description?: string;
	diningStyle?: string;
	dressCode?: string;
	privateEventDetails?: string;
	cateringDetails?: string;
	executiveChef?: string;
	crossStreet?: string;
	location?: {
		address?: {
			line1?: string;
			line2?: string;
			street?: string;
			city?: string;
			state?: string;
			province?: string;
			country?: string;
			postalCode?: string;
		};
		coordinates?: {
			latitude?: number | string;
			longitude?: number | string;
		};
		neighborhoodName?: string;
	};
	profileImage?: string | { url: string };
	images?: Array<{ url: string; caption?: string }>;
	tags?: string[];
	openingTimes?: Record<string, Array<{ start: string; end: string }>>;
}

export const GET: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;
	const auth = getAuthContext(event)!;

	const db = event.locals.db;

	const rest = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);

	if (rest.length === 0) return apiError('Restaurant not found', 404);

	const r = rest[0];
	const profilePhoto = r.profilePhotoUrl;
	const photoId = r.rid;

	return apiSuccess({
		rid: r.rid,
		name: r.name,
		address: r.address ?? '',
		address2: r.address2 ?? '',
		city: r.city ?? '',
		state: r.state ?? '',
		country: r.country ?? 'US',
		latitude: r.latitude ? String(r.latitude) : null,
		longitude: r.longitude ? String(r.longitude) : null,
		postal_code: r.postalCode ?? '',
		phone_number: r.phone ?? '',
		metro_name: r.metroName ?? '',
		reservation_url: r.reservationUrl ?? null,
		profile_url: r.profileUrl ?? null,
		natural_reservation_url: r.reservationUrl ?? null,
		natural_profile_url: r.profileUrl ?? null,
		profile_photo: profilePhoto
			? {
					id: photoId,
					sizes: {
						small: {
							url: profilePhoto,
							width: 160,
							height: 160
						},
						xsmall: {
							url: profilePhoto,
							width: 105,
							height: 105
						},
						legacy: {
							url: profilePhoto,
							width: 208,
							height: 208
						},
						'wide-xlarge': {
							url: profilePhoto,
							width: 752,
							height: 423
						},
						large: {
							url: profilePhoto,
							width: 640,
							height: 640
						},
						xlarge: {
							url: profilePhoto,
							width: 752,
							height: 752
						},
						'wide-large': {
							url: profilePhoto,
							width: 640,
							height: 360
						},
						medium: {
							url: profilePhoto,
							width: 320,
							height: 320
						},
						'wide-mlarge': {
							url: profilePhoto,
							width: 480,
							height: 270
						},
						'wide-medium': {
							url: profilePhoto,
							width: 320,
							height: 180
						},
						huge: {
							url: profilePhoto,
							width: 1280,
							height: 1280
						},
						'wide-huge': {
							url: profilePhoto,
							width: 1280,
							height: 720
						},
						'wide-small': {
							url: profilePhoto,
							width: 160,
							height: 90
						}
					}
				}
			: null
	});
};

export const POST: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;
	const auth = getAuthContext(event)!;

	const requestId = getRequestId(event);
	const db = event.locals.db;

	const parsed = await parseJsonBody<ProfileUpdateBody>(event);
	if ('error' in parsed) return parsed.error;
	const body = parsed.data;

	// Resolve restaurant
	const rest = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);

	if (rest.length === 0) return apiError('Restaurant not found', 404);
	const restaurant = rest[0];

	// Build update object
	const updateData: Record<string, unknown> = {
		updatedAt: new Date().toISOString()
	};

	if (body.name !== undefined) updateData.name = body.name;
	if (body.primaryCuisine !== undefined) updateData.primaryCuisine = body.primaryCuisine;
	if (body.phone !== undefined) updateData.phone = body.phone;
	if (body.currency !== undefined) updateData.currency = body.currency;
	if (body.locale !== undefined) updateData.locale = body.locale;
	if (body.website !== undefined) updateData.website = body.website;
	if (body.timeZone !== undefined) updateData.timezone = body.timeZone;
	if (body.priceBandId !== undefined) updateData.priceBandId = body.priceBandId;
	if (body.description !== undefined) updateData.description = body.description;
	if (body.diningStyle !== undefined) updateData.diningStyle = body.diningStyle;
	if (body.dressCode !== undefined) updateData.dressCode = body.dressCode;
	if (body.privateEventDetails !== undefined) updateData.privateEventDetails = body.privateEventDetails;
	if (body.cateringDetails !== undefined) updateData.cateringDetails = body.cateringDetails;
	if (body.executiveChef !== undefined) updateData.executiveChef = body.executiveChef;
	if (body.crossStreet !== undefined) updateData.crossStreet = body.crossStreet;
	if (body.profileImage !== undefined) {
		updateData.profilePhotoUrl = typeof body.profileImage === 'string'
			? body.profileImage
			: body.profileImage?.url ?? null;
	}
	if (body.tags !== undefined) updateData.tags = body.tags;
	if (body.openingTimes !== undefined) updateData.openingTimes = body.openingTimes;

	if (body.location) {
		if (body.location.address) {
			const addr = body.location.address;
			const streetVal = addr.street ?? addr.line1;
			if (streetVal !== undefined) updateData.address = streetVal;
			if (addr.line2 !== undefined) updateData.address2 = addr.line2;
			if (addr.city !== undefined) updateData.city = addr.city;
			const stateVal = addr.province ?? addr.state;
			if (stateVal !== undefined) updateData.state = stateVal;
			if (addr.country !== undefined) updateData.country = addr.country;
			if (addr.postalCode !== undefined) updateData.postalCode = addr.postalCode;
		}
		if (body.location.coordinates) {
			if (body.location.coordinates.latitude !== undefined) updateData.latitude = Number(body.location.coordinates.latitude);
			if (body.location.coordinates.longitude !== undefined) updateData.longitude = Number(body.location.coordinates.longitude);
		}
		if (body.location.neighborhoodName !== undefined) updateData.neighborhoodName = body.location.neighborhoodName;
	}

	await db
		.update(restaurants)
		.set(updateData)
		.where(eq(restaurants.id, restaurant.id));

	return apiSuccess(
		{
			requestId,
			itemStatus: [
				{
					itemId: body.id ?? String(rid),
					sequenceId: Math.floor(Math.random() * 2147483647),
					status: 'Processing'
				}
			],
			totalItems: 1,
			totalProcessedItems: 1,
			created: new Date().toISOString()
		},
		200
	);
};
