import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { restaurants, reviews, reviewReplies } from '$db/schema';
import { getAuthContext, apiError, requireAuthorizedRid, parseJsonBody } from '$api/helpers';
import { json } from '@sveltejs/kit';

interface ReplyBody {
	Message: string;
	From?: string;
	Name?: string;
	IsPublic?: boolean;
	ReplyingToReplyId?: string;
	ReplyToEmail?: string;
}

export const POST: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;
	const auth = getAuthContext(event)!;

	const reviewId = event.params.review_id;
	if (!reviewId) return apiError('Review ID is required', 400);

	const db = event.locals.db;

	const parsed = await parseJsonBody<ReplyBody>(event);
	if ('error' in parsed) return parsed.error;
	const body = parsed.data;

	if (!body.Message) {
		return apiError('Message is required', 400);
	}

	// Resolve restaurant
	const rest = await db
		.select()
		.from(restaurants)
		.where(and(eq(restaurants.rid, rid), eq(restaurants.active, true)))
		.limit(1);

	if (rest.length === 0) return apiError('Restaurant not found', 404);
	const restaurant = rest[0];

	// Find the review
	const review = await db
		.select()
		.from(reviews)
		.where(
			and(eq(reviews.reviewId, reviewId), eq(reviews.restaurantId, restaurant.id))
		)
		.limit(1);

	if (review.length === 0) return apiError('Review not found', 404);

	const replyId = crypto.randomUUID().replace(/-/g, '');

	// Insert reply
	await db.insert(reviewReplies).values({
		id: replyId,
		reviewId: review[0].id,
		message: body.Message,
		from: body.From ?? 'Restaurant',
		name: body.Name ?? null,
		isPublic: body.IsPublic ?? true,
		replyingToReplyId: body.ReplyingToReplyId ?? null,
		replyToEmail: body.ReplyToEmail ?? null
	});

	return json(
		{
			ReplyId: replyId,
			ResponseDateTimeUtc: new Date().toISOString(),
			Message: body.Message,
			From: body.From ?? 'Restaurant',
			RestaurantId: rid,
			ReviewId: reviewId,
			ReplyToEmail: body.ReplyToEmail ?? null,
			Name: body.Name ?? null,
			ModerationState: 'PENDING',
			Language: null,
			IsPublic: body.IsPublic ?? true,
			ReplyingToReplyId: body.ReplyingToReplyId ?? ''
		},
		{ status: 202 }
	);
};
