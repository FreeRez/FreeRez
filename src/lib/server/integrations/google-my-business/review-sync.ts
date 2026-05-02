import type { Database } from '$db';
import { schema } from '$db';
import { eq, and } from 'drizzle-orm';
import type { SyncResult } from '../types';
import { STAR_RATING_MAP, type GoogleReview } from './types';
import { listReviews } from './client';
import { log } from '$lib/server/logger';

export async function syncReviews(
	db: Database,
	accessToken: string,
	locationName: string,
	restaurantId: string,
	rid: number
): Promise<SyncResult> {
	const result: SyncResult = { synced: 0, created: 0, updated: 0, errors: [] };

	let pageToken: string | undefined;

	do {
		const response = await listReviews(accessToken, locationName, 50, pageToken);
		const reviews = response.reviews ?? [];

		for (const googleReview of reviews) {
			try {
				await upsertReview(db, googleReview, restaurantId, rid);
				result.synced++;
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				result.errors.push(`Review ${googleReview.reviewId}: ${msg}`);
				log('error', 'gmb.review_sync.item_failed', {
					reviewId: googleReview.reviewId,
					error: msg,
				});
			}
		}

		pageToken = response.nextPageToken;
	} while (pageToken);

	log('info', 'gmb.review_sync.completed', {
		restaurantId,
		synced: result.synced,
		created: result.created,
		updated: result.updated,
		errors: result.errors.length,
	});

	return result;
}

async function upsertReview(
	db: Database,
	googleReview: GoogleReview,
	restaurantId: string,
	rid: number
): Promise<'created' | 'updated' | 'unchanged'> {
	const externalReviewId = `gmb-${googleReview.reviewId}`;

	const existing = await db
		.select({ id: schema.reviews.id, lastModifiedDateTimeUtc: schema.reviews.lastModifiedDateTimeUtc })
		.from(schema.reviews)
		.where(
			and(
				eq(schema.reviews.reviewId, externalReviewId),
				eq(schema.reviews.restaurantId, restaurantId)
			)
		)
		.limit(1);

	const overallRating = STAR_RATING_MAP[googleReview.starRating] ?? 0;
	const now = new Date().toISOString();

	if (existing.length === 0) {
		await db.insert(schema.reviews).values({
			restaurantId,
			rid,
			reviewId: externalReviewId,
			customerNickname: googleReview.reviewer.displayName,
			dinerInitials: googleReview.reviewer.displayName.slice(0, 2).toUpperCase(),
			ratingOverall: overallRating,
			reviewText: googleReview.comment ?? null,
			dinedDateTime: googleReview.createTime,
			submissionDateTimeUtc: googleReview.createTime,
			lastModifiedDateTimeUtc: googleReview.updateTime,
			moderationState: 2,
			simplifiedModerationState: 'APPROVED',
			language: 'en',
			locale: 'en-US',
			countryCode: 'US',
			source: 'google-my-business',
			createdAt: now,
		});

		if (googleReview.reviewReply) {
			const reviewRows = await db
				.select({ id: schema.reviews.id })
				.from(schema.reviews)
				.where(eq(schema.reviews.reviewId, externalReviewId))
				.limit(1);

			if (reviewRows.length > 0) {
				await db.insert(schema.reviewReplies).values({
					reviewId: reviewRows[0].id,
					message: googleReview.reviewReply.comment,
					from: 'Restaurant',
					name: 'Restaurant',
					isPublic: true,
					externalReplyState: googleReview.reviewReply.reviewReplyState ?? null,
				});
			}
		}

		return 'created';
	}

	if (existing[0].lastModifiedDateTimeUtc !== googleReview.updateTime) {
		await db
			.update(schema.reviews)
			.set({
				ratingOverall: overallRating,
				reviewText: googleReview.comment ?? null,
				lastModifiedDateTimeUtc: googleReview.updateTime,
			})
			.where(eq(schema.reviews.id, existing[0].id));

		return 'updated';
	}

	return 'unchanged';
}

export function extractGoogleReviewId(reviewId: string): string | null {
	if (!reviewId.startsWith('gmb-')) return null;
	return reviewId.slice(4);
}
