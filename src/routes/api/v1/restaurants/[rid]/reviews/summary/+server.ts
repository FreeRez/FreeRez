import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { restaurants, reviews } from '$db/schema';
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

	const restaurantReviews = await db
		.select()
		.from(reviews)
		.where(eq(reviews.restaurantId, restaurant.id));

	const count = restaurantReviews.length;

	if (count === 0) {
		return apiSuccess({
			Rid: rid,
			Ratings: {
				OverallRatingsDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
				DinersRecommendations: { Count: 0, Yes: 0, No: 0 },
				Count: 0,
				Overall: { Rating: 0, Count: 0 },
				Food: { Rating: 0, Count: 0 },
				Service: { Rating: 0, Count: 0 },
				Ambience: { Rating: 0, Count: 0 },
				Value: { Rating: 0, Count: 0 },
				Noise: { Rating: 0, Count: 0 }
			},
			CategoryDistribution: [],
			TotalNumberOfReviews: 0,
			AllTimeTextReviewCount: 0
		});
	}

	// Calculate rating distributions
	const overallDist: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
	let totalOverall = 0;
	let totalFood = 0;
	let totalService = 0;
	let totalAmbience = 0;
	let totalValue = 0;
	let totalNoise = 0;
	let countOverall = 0;
	let countFood = 0;
	let countService = 0;
	let countAmbience = 0;
	let countValue = 0;
	let countNoise = 0;
	let recommendedYes = 0;
	let recommendedNo = 0;
	let recommendedCount = 0;
	let textReviewCount = 0;
	const categoryDistMap: Record<string, { Name: string; Count: number; Key: string }> = {};

	for (const review of restaurantReviews) {
		if (review.ratingOverall !== null) {
			const key = String(review.ratingOverall);
			if (key in overallDist) overallDist[key]++;
			totalOverall += review.ratingOverall;
			countOverall++;
		}
		if (review.ratingFood !== null) { totalFood += review.ratingFood; countFood++; }
		if (review.ratingService !== null) { totalService += review.ratingService; countService++; }
		if (review.ratingAmbience !== null) { totalAmbience += review.ratingAmbience; countAmbience++; }
		if (review.ratingValue !== null) { totalValue += review.ratingValue; countValue++; }
		if (review.ratingNoise !== null) { totalNoise += review.ratingNoise; countNoise++; }
		if (review.recommended !== null && review.recommended !== undefined) {
			recommendedCount++;
			if (review.recommended) recommendedYes++;
			else recommendedNo++;
		}
		if (review.reviewText) textReviewCount++;

		const cats = review.categories as Array<{ Id: string; Label: string }> | null;
		if (cats) {
			for (const cat of cats) {
				if (!categoryDistMap[cat.Id]) {
					categoryDistMap[cat.Id] = { Name: cat.Label, Count: 0, Key: cat.Id };
				}
				categoryDistMap[cat.Id].Count++;
			}
		}
	}

	return apiSuccess({
		Rid: rid,
		Ratings: {
			OverallRatingsDistribution: overallDist,
			DinersRecommendations: { Count: recommendedCount, Yes: recommendedYes, No: recommendedNo },
			Count: count,
			Overall: { Rating: countOverall > 0 ? Math.round((totalOverall / countOverall) * 10) / 10 : 0, Count: countOverall },
			Food: { Rating: countFood > 0 ? Math.round((totalFood / countFood) * 10) / 10 : 0, Count: countFood },
			Service: { Rating: countService > 0 ? Math.round((totalService / countService) * 10) / 10 : 0, Count: countService },
			Ambience: { Rating: countAmbience > 0 ? Math.round((totalAmbience / countAmbience) * 10) / 10 : 0, Count: countAmbience },
			Value: { Rating: countValue > 0 ? Math.round((totalValue / countValue) * 10) / 10 : 0, Count: countValue },
			Noise: { Rating: countNoise > 0 ? Math.round((totalNoise / countNoise) * 10) / 10 : 0, Count: countNoise }
		},
		CategoryDistribution: Object.values(categoryDistMap),
		TotalNumberOfReviews: count,
		AllTimeTextReviewCount: textReviewCount
	});
};
