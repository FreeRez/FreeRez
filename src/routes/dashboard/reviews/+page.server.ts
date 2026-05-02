import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.db) {
		return { reviews: [] };
	}

	const { getRestaurantForUser, getReviews } = await import('$lib/server/dashboard/queries');
	const { normalizeReview } = await import('$lib/server/dashboard/normalize');

	const restaurant = await getRestaurantForUser(locals.db, locals.user?.id ?? '');
	if (!restaurant) {
		return { reviews: [] };
	}

	const rawReviews = await getReviews(locals.db, restaurant.id);
	return {
		reviews: rawReviews.map(normalizeReview),
	};
};

export const actions: Actions = {
	reply: async ({ request, locals }) => {
		if (!locals.db) return { success: false, error: 'No database' };
		const formData = await request.formData();
		const reviewId = formData.get('reviewId') as string;
		const message = formData.get('message') as string;
		const author = formData.get('author') as string || 'Restaurant';
		const { createReviewReply } = await import('$lib/server/dashboard/queries');
		await createReviewReply(locals.db, reviewId, message, author);
		return { success: true };
	}
};
