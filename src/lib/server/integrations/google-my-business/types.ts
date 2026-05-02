export const STAR_RATING_MAP: Record<string, number> = {
	STAR_RATING_UNSPECIFIED: 0,
	ONE: 1,
	TWO: 2,
	THREE: 3,
	FOUR: 4,
	FIVE: 5,
};

export interface GoogleReview {
	name: string;
	reviewId: string;
	reviewer: {
		displayName: string;
		profilePhotoUrl?: string;
	};
	starRating: string;
	comment?: string;
	createTime: string;
	updateTime: string;
	reviewReply?: {
		comment: string;
		updateTime: string;
		reviewReplyState?: string;
	};
}

export interface GoogleReviewListResponse {
	reviews?: GoogleReview[];
	averageRating?: number;
	totalReviewCount?: number;
	nextPageToken?: string;
}

export interface GoogleAccount {
	name: string;
	accountName: string;
	type: string;
	role?: string;
}

export interface GoogleLocation {
	name: string;
	title: string;
	storefrontAddress?: {
		addressLines?: string[];
		locality?: string;
		administrativeArea?: string;
		postalCode?: string;
	};
}

export interface GoogleRegularHours {
	periods: GoogleTimePeriod[];
}

export interface GoogleTimePeriod {
	openDay: string;
	openTime: string;
	closeDay: string;
	closeTime: string;
}

export interface HoursComparisonResult {
	matches: boolean;
	diffs: HoursDiff[];
}

export interface HoursDiff {
	day: string;
	freerez: Array<{ start: string; end: string }> | null;
	google: Array<{ start: string; end: string }> | null;
}

export type FreerezOpeningTimes = Record<string, Array<{ start: string; end: string }>>;
