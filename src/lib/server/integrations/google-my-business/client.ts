import type {
	GoogleReviewListResponse,
	GoogleAccount,
	GoogleLocation,
	GoogleRegularHours,
} from './types';

const GMB_BASE = 'https://mybusiness.googleapis.com/v4';
const BUSINESS_INFO_BASE = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const ACCOUNT_MGMT_BASE = 'https://mybusinessaccountmanagement.googleapis.com/v1';

async function gmbFetch<T>(url: string, token: string, init?: RequestInit): Promise<T> {
	const response = await fetch(url, {
		...init,
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
			...init?.headers,
		},
	});

	if (!response.ok) {
		const text = await response.text();
		throw new GmbApiError(response.status, text, url);
	}

	return response.json() as Promise<T>;
}

export class GmbApiError extends Error {
	constructor(
		public status: number,
		public body: string,
		public url: string
	) {
		super(`GMB API error ${status}: ${body}`);
		this.name = 'GmbApiError';
	}

	get isUnauthorized(): boolean {
		return this.status === 401;
	}

	get isRateLimited(): boolean {
		return this.status === 429;
	}
}

export async function listAccounts(token: string): Promise<GoogleAccount[]> {
	const data = await gmbFetch<{ accounts?: GoogleAccount[] }>(
		`${ACCOUNT_MGMT_BASE}/accounts`,
		token
	);
	return data.accounts ?? [];
}

export async function listLocations(
	token: string,
	accountName: string
): Promise<GoogleLocation[]> {
	const data = await gmbFetch<{ locations?: GoogleLocation[] }>(
		`${BUSINESS_INFO_BASE}/${accountName}/locations?readMask=name,title,storefrontAddress`,
		token
	);
	return data.locations ?? [];
}

export async function listReviews(
	token: string,
	locationName: string,
	pageSize = 50,
	pageToken?: string
): Promise<GoogleReviewListResponse> {
	const params = new URLSearchParams({ pageSize: String(pageSize) });
	if (pageToken) params.set('pageToken', pageToken);

	return gmbFetch<GoogleReviewListResponse>(
		`${GMB_BASE}/${locationName}/reviews?${params}`,
		token
	);
}

export async function getReview(
	token: string,
	reviewName: string
): Promise<{ review: unknown }> {
	return gmbFetch(`${GMB_BASE}/${reviewName}`, token);
}

export async function replyToReview(
	token: string,
	reviewName: string,
	comment: string
): Promise<{ comment: string; updateTime: string }> {
	return gmbFetch(`${GMB_BASE}/${reviewName}/reply`, token, {
		method: 'PUT',
		body: JSON.stringify({ comment }),
	});
}

export async function deleteReviewReply(
	token: string,
	reviewName: string
): Promise<void> {
	await gmbFetch(`${GMB_BASE}/${reviewName}/reply`, token, {
		method: 'DELETE',
	});
}

export async function getLocationHours(
	token: string,
	locationName: string
): Promise<GoogleRegularHours | null> {
	const data = await gmbFetch<{ regularHours?: GoogleRegularHours }>(
		`${BUSINESS_INFO_BASE}/${locationName}?readMask=regularHours`,
		token
	);
	return data.regularHours ?? null;
}

export async function updateLocationHours(
	token: string,
	locationName: string,
	hours: GoogleRegularHours
): Promise<void> {
	await gmbFetch(
		`${BUSINESS_INFO_BASE}/${locationName}?updateMask=regularHours`,
		token,
		{
			method: 'PATCH',
			body: JSON.stringify({ regularHours: hours }),
		}
	);
}
