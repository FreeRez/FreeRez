import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const user = locals.user;

	if (!user) {
		return redirect(302, `/login?returnUrl=${encodeURIComponent(url.pathname)}`);
	}

	let reviewCount = 0;
	let restaurantName = '';
	if (locals.db) {
		const { getRestaurantForUser, getReviewCount } = await import('$lib/server/dashboard/queries');
		const restaurant = await getRestaurantForUser(locals.db, user.id);
		if (restaurant) {
			reviewCount = await getReviewCount(locals.db, restaurant.id);
			restaurantName = restaurant.name;
		}
	}

	return {
		user: {
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role
		},
		reviewCount,
		restaurantName,
	};
};
