import type { RequestHandler } from './$types';
import { restaurants } from '$db/schema';
import { eq } from 'drizzle-orm';
import {
	apiError,
	apiSuccess,
	getAuthContext,
	parseIntParam
} from '$api/helpers';

export const GET: RequestHandler = async (event) => {
	const auth = getAuthContext(event);
	if (!auth) return apiError('Unauthorized', 401);

	const { url, locals } = event;
	const db = locals.db;

	const limit = parseIntParam(url.searchParams.get('limit'), 10);
	const offset = parseIntParam(url.searchParams.get('offset'), 0);

	const rows = await db
		.select()
		.from(restaurants)
		.where(eq(restaurants.active, true))
		.limit(limit)
		.offset(offset);

	const totalResult = await db
		.select()
		.from(restaurants)
		.where(eq(restaurants.active, true));
	const totalItems = totalResult.length;

	const items = rows.map((r) => {
		const profilePhoto = r.profilePhotoUrl;
		const photoId = r.rid;
		return {
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
		};
	});

	return apiSuccess({
		total_items: totalItems,
		offset,
		limit,
		items
	});
};
