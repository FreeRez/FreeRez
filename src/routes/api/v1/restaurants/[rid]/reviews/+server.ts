import type { RequestHandler } from './$types';
import { eq, and, desc, asc } from 'drizzle-orm';
import { restaurants, reviews } from '$db/schema';
import { getAuthContext, apiError, apiSuccess, apiValidationError, requireAuthorizedRid, parseIntParam, parseJsonBody, validate } from '$api/helpers';

export const GET: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;
	const auth = getAuthContext(event)!;

	const { url, locals } = event;
	const db = locals.db;

	const numberOfReviews = parseIntParam(url.searchParams.get('NumberOfReviews'), 5);
	const offset = parseIntParam(url.searchParams.get('Offset'), 0);
	const language = url.searchParams.get('Language') ?? 'en';
	const sort = url.searchParams.get('Sort') ?? 'newest';

	// Resolve restaurant
	const rest = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);

	if (rest.length === 0) return apiError('Restaurant not found', 404);
	const restaurant = rest[0];

	// Build sort order
	const orderBy = sort === 'oldest'
		? asc(reviews.dinedDateTime)
		: sort === 'highest'
			? desc(reviews.ratingOverall)
			: sort === 'lowest'
				? asc(reviews.ratingOverall)
				: desc(reviews.dinedDateTime);

	// Fetch reviews
	const conditions = [eq(reviews.restaurantId, restaurant.id)];
	if (language !== 'all') {
		conditions.push(eq(reviews.language, language));
	}

	const allReviews = await db
		.select()
		.from(reviews)
		.where(and(...conditions))
		.orderBy(orderBy);

	const totalCount = allReviews.length;
	const pagedReviews = allReviews.slice(offset, offset + numberOfReviews);

	return apiSuccess({
		TotalCount: totalCount,
		Reviews: pagedReviews.map(mapReviewResponse(rid))
	});
};

function mapReviewResponse(rid: number) {
	return (r: typeof reviews.$inferSelect) => ({
		CountryCode: r.countryCode,
		CustomerName: null,
		CustomerNickname: r.customerNickname,
		CustomerEmailAddress: null,
		DomainId: 1,
		Featured: r.featured,
		Locale: r.locale,
		Language: r.language,
		MetroId: r.metroId,
		ModerationState: r.moderationState,
		SimplifiedModerationState: r.simplifiedModerationState,
		Rating: {
			Overall: r.ratingOverall,
			Food: r.ratingFood,
			Service: r.ratingService,
			Ambience: r.ratingAmbience,
			Value: r.ratingValue,
			Noise: r.ratingNoise
		},
		Recommended: r.recommended,
		RestaurantComment: '',
		RestaurantId: rid,
		DinedDateTime: r.dinedDateTime,
		ReservationId: r.reservationId,
		ReviewId: r.reviewId,
		ReviewText: r.reviewText,
		ReviewTitle: r.reviewTitle,
		ReviewType: r.reviewType,
		SubmissionDateTimeUtc: r.submissionDateTimeUtc,
		CustomQuestions: null,
		NeighborhoodId: null,
		GpId: r.gpId,
		LastModifiedDateTimeUtc: r.lastModifiedDateTimeUtc,
		TagVotes: null,
		Helpfulness: {
			Up: r.helpfulnessUp ?? 0,
			Down: r.helpfulnessDown ?? 0,
			Score: (r.helpfulnessUp ?? 0) - (r.helpfulnessDown ?? 0)
		},
		UpdatedByDinerDateTimeUtc: null,
		IsDraft: r.isDraft,
		Categories: r.categories ?? [],
		DinerInitials: r.dinerInitials,
		DinerMetroId: r.dinerMetroId,
		DinerIsVip: r.dinerIsVip,
		Photos: r.photos ?? [],
		OriginalSubmissionDateTimeUtc: r.submissionDateTimeUtc,
		ResponseLink: null
	});
}

interface ReviewBody {
	CustomerNickname: string;
	Rating: {
		Overall: number;
		Food?: number;
		Service?: number;
		Ambience?: number;
		Value?: number;
		Noise?: number;
	};
	ReviewText?: string;
	ReviewTitle?: string;
	DinedDateTime?: string;
	Recommended?: boolean;
	Language?: string;
	Locale?: string;
	CountryCode?: string;
	Categories?: Array<{ Id: string; Label: string }>;
	DinerInitials?: string;
	GpId?: string;
	ReservationId?: number;
}

export const POST: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;

	const db = event.locals.db;

	const rest = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);

	if (rest.length === 0) return apiError('Restaurant not found', 404);
	const restaurant = rest[0];

	const parsed = await parseJsonBody<ReviewBody>(event);
	if ('error' in parsed) return parsed.error;
	const body = parsed.data;

	const errors = validate([
		{ field: 'CustomerNickname', value: body.CustomerNickname, required: true, type: 'string', minLength: 1, maxLength: 100 },
		{ field: 'Rating.Overall', value: body.Rating?.Overall, required: true, type: 'number', min: 1, max: 5 }
	]);
	if (errors.length > 0) return apiValidationError(errors);

	const rating = body.Rating;
	const reviewId = `OT-${rid}-${Date.now()}`;
	const now = new Date().toISOString();

	const [created] = await db.insert(reviews).values({
		restaurantId: restaurant.id,
		rid,
		reviewId,
		reservationId: body.ReservationId ?? null,
		gpId: body.GpId ?? null,
		countryCode: body.CountryCode ?? 'US',
		customerNickname: body.CustomerNickname,
		locale: body.Locale ?? 'en-US',
		language: body.Language ?? 'en',
		moderationState: 2,
		simplifiedModerationState: 'APPROVED',
		ratingOverall: rating.Overall,
		ratingFood: rating.Food ?? null,
		ratingService: rating.Service ?? null,
		ratingAmbience: rating.Ambience ?? null,
		ratingValue: rating.Value ?? null,
		ratingNoise: rating.Noise ?? null,
		recommended: body.Recommended ?? null,
		reviewText: body.ReviewText ?? null,
		reviewTitle: body.ReviewTitle ?? null,
		dinedDateTime: body.DinedDateTime ?? now,
		submissionDateTimeUtc: now,
		lastModifiedDateTimeUtc: now,
		categories: body.Categories ?? null,
		dinerInitials: body.DinerInitials ?? body.CustomerNickname.slice(0, 2).toUpperCase(),
	}).returning();

	return apiSuccess(mapReviewResponse(rid)(created), 201);
};
