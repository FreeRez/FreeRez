import type { RequestHandler } from './$types';
import { apiError, apiSuccess, requireIntegrationRestaurant, parseJsonBody } from '$api/helpers';
import { schema } from '$db';
import { eq, and } from 'drizzle-orm';
import { getProviderConfig, resolveCredentials } from '$lib/server/integrations/registry';
import { ensureValidToken } from '$lib/server/integrations/token-manager';
import { replyToReview } from '$lib/server/integrations/google-my-business/client';
import { extractGoogleReviewId } from '$lib/server/integrations/google-my-business/review-sync';
import { reviews } from '$db/schema';

export const POST: RequestHandler = async (event) => {
	const reviewId = event.params.review_id;
	if (!reviewId) return apiError('Review ID is required', 400);

	const result = await requireIntegrationRestaurant(event, 'google-my-business');
	if (result instanceof Response) return result;
	const { restaurant, integration } = result;

	const db = event.locals.db;

	const parsed = await parseJsonBody<{ Message: string }>(event);
	if ('error' in parsed) return parsed.error;
	if (!parsed.data.Message) return apiError('Message is required', 400);

	const review = await db
		.select()
		.from(reviews)
		.where(and(eq(reviews.id, reviewId), eq(reviews.restaurantId, restaurant.id)))
		.limit(1);

	if (review.length === 0) return apiError('Review not found', 404);

	const googleReviewId = extractGoogleReviewId(review[0].reviewId);
	if (!googleReviewId) return apiError('This review is not from Google', 400);

	const config = getProviderConfig('google-my-business')!;
	const env = (event.platform?.env ?? {}) as Record<string, string | undefined>;
	const credentials = resolveCredentials(config, env);
	if (!credentials) return apiError('Integration not configured', 503);

	const integ = integration as typeof schema.partnerIntegrations.$inferSelect;
	const accessToken = await ensureValidToken(db, integ, config, credentials);
	const locationName = integ.partnerIdentifier;
	if (!locationName) return apiError('No location linked', 400);

	const reviewName = `${locationName}/reviews/${googleReviewId}`;
	const googleReply = await replyToReview(accessToken, reviewName, parsed.data.Message);

	return apiSuccess({
		Message: parsed.data.Message,
		GoogleUpdateTime: googleReply.updateTime,
		ReviewId: reviewId,
	});
};
