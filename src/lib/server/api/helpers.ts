import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

// ─── Response Helpers ────────────────────────────────────────────────────────

export type ApiErrorDetail = {
	message: string;
	code?: string;
	field?: string;
};

export function apiSuccess<T>(data: T, status: number = 200) {
	return json(data, { status });
}

export function apiError(message: string, status: number = 400, code?: string) {
	const body: { errors: ApiErrorDetail[]; requestid: string } = {
		errors: [{ message, ...(code ? { code } : {}) }],
		requestid: crypto.randomUUID()
	};
	return json(body, { status });
}

export function apiValidationError(errors: ApiErrorDetail[]) {
	return json({ errors, requestid: crypto.randomUUID() }, { status: 400 });
}

export function paginatedResponse<T>(
	items: T[],
	offset: number,
	limit: number,
	_total?: number
) {
	const hasNextPage = items.length === limit;
	return {
		hasNextPage,
		nextPageUrl: hasNextPage ? `?offset=${offset + limit}&limit=${limit}` : null,
		offset,
		limit,
		items
	};
}

// ─── Auth Context ────────────────────────────────────────────────────────────

export type AuthContext = {
	clientId: string;
	tenantId: string;
	partnerId: string | null;
	tier: string;
	scope: string;
	allowedRids: number[] | null;
};

export function getAuthContext(event: RequestEvent): AuthContext | null {
	const tenant = event.locals.tenant;
	if (!tenant) return null;

	return {
		clientId: tenant.clientId,
		tenantId: tenant.tenantId,
		partnerId: tenant.partnerId,
		tier: tenant.tier,
		scope: tenant.scope,
		allowedRids: tenant.allowedRids
	};
}

/** @deprecated Use getAuthContext instead */
export const validateBearerToken = getAuthContext;

// ─── RID Authorization ───────────────────────────────────────────────────────

export function requireAuthorizedRid(event: RequestEvent): number | Response {
	const rid = event.params.rid;
	if (!rid) return apiError('Restaurant ID (rid) is required', 400) as unknown as Response;
	const parsed = parseInt(rid, 10);
	if (isNaN(parsed)) return apiError('Invalid restaurant ID', 400) as unknown as Response;

	const auth = getAuthContext(event);
	if (!auth) return apiError('Unauthorized', 401) as unknown as Response;

	if (auth.allowedRids && auth.allowedRids.length > 0 && !auth.allowedRids.includes(parsed)) {
		return apiError('Permission denied', 403) as unknown as Response;
	}

	return parsed;
}

/** @deprecated Use requireAuthorizedRid instead */
export const requireRid = requireAuthorizedRid;

// ─── Request Body Parsing ────────────────────────────────────────────────────

const MAX_BODY_SIZE = 1024 * 1024; // 1MB

export async function parseJsonBody<T = Record<string, unknown>>(
	event: RequestEvent
): Promise<{ data: T } | { error: Response }> {
	const contentLength = event.request.headers.get('Content-Length');
	if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
		return { error: apiError('Request body too large', 413) };
	}

	try {
		const text = await event.request.text();
		if (text.length > MAX_BODY_SIZE) {
			return { error: apiError('Request body too large', 413) };
		}
		if (text.length === 0) {
			return { error: apiError('Request body is required', 400) };
		}
		const data = JSON.parse(text) as T;
		return { data };
	} catch {
		return { error: apiError('Invalid JSON body', 400) };
	}
}

// ─── Input Validation ────────────────────────────────────────────────────────

type ValidationRule = {
	field: string;
	value: unknown;
	required?: boolean;
	type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
	minLength?: number;
	maxLength?: number;
	min?: number;
	max?: number;
	pattern?: RegExp;
	enum?: readonly string[];
};

export function validate(rules: ValidationRule[]): ApiErrorDetail[] {
	const errors: ApiErrorDetail[] = [];

	for (const rule of rules) {
		const { field, value, required, type, minLength, maxLength, min, max, pattern } = rule;

		if (required && (value === undefined || value === null || value === '')) {
			errors.push({ message: `${field} is required`, field });
			continue;
		}

		if (value === undefined || value === null) continue;

		if (type && typeof value !== type && !(type === 'array' && Array.isArray(value))) {
			errors.push({ message: `${field} must be a ${type}`, field });
			continue;
		}

		if (typeof value === 'string') {
			if (minLength !== undefined && value.length < minLength) {
				errors.push({ message: `${field} must be at least ${minLength} characters`, field });
			}
			if (maxLength !== undefined && value.length > maxLength) {
				errors.push({ message: `${field} must be at most ${maxLength} characters`, field });
			}
			if (pattern && !pattern.test(value)) {
				errors.push({ message: `${field} format is invalid`, field });
			}
		}

		if (typeof value === 'number') {
			if (min !== undefined && value < min) {
				errors.push({ message: `${field} must be at least ${min}`, field });
			}
			if (max !== undefined && value > max) {
				errors.push({ message: `${field} must be at most ${max}`, field });
			}
		}

		if (rule.enum && typeof value === 'string' && !rule.enum.includes(value)) {
			errors.push({ message: `${field} must be one of: ${rule.enum.join(', ')}`, field });
		}
	}

	return errors;
}

// ─── Param Helpers ───────────────────────────────────────────────────────────

export function parseIntParam(value: string | null, defaultValue: number): number {
	if (!value) return defaultValue;
	const parsed = parseInt(value, 10);
	return isNaN(parsed) ? defaultValue : parsed;
}

export function getRequestId(event: RequestEvent): string {
	return event.request.headers.get('X-Request-Id') ?? crypto.randomUUID();
}

// ─── Integration Auth ────────────────────────────────────────────────────────

export async function requireIntegrationRestaurant(
	event: RequestEvent,
	providerId: string
): Promise<
	| { restaurant: { id: string; rid: number }; integration: Record<string, unknown> }
	| Response
> {
	const db = event.locals.db;
	if (!db) return apiError('Database unavailable', 503);

	const user = event.locals.user;
	if (!user) return apiError('Authentication required', 401);

	const restaurantId =
		event.url.searchParams.get('restaurantId') ??
		(event.request.method !== 'GET'
			? ((await event.request.clone().json().catch(() => ({}))) as Record<string, string>)
					.restaurantId
			: null);

	if (!restaurantId) return apiError('restaurantId is required', 400);

	const { restaurants } = await import('$db/schema');
	const { eq, and } = await import('drizzle-orm');
	const { partnerIntegrations } = await import('$db/schema');

	const rest = await db
		.select({ id: restaurants.id, rid: restaurants.rid })
		.from(restaurants)
		.where(and(eq(restaurants.id, restaurantId), eq(restaurants.active, true)))
		.limit(1);

	if (rest.length === 0) return apiError('Restaurant not found', 404);

	const integration = await db
		.select()
		.from(partnerIntegrations)
		.where(
			and(
				eq(partnerIntegrations.restaurantId, restaurantId),
				eq(partnerIntegrations.partnerId, providerId),
				eq(partnerIntegrations.status, 'active')
			)
		)
		.limit(1);

	if (integration.length === 0) {
		return apiError(`${providerId} not connected`, 404);
	}

	return {
		restaurant: rest[0],
		integration: integration[0] as unknown as Record<string, unknown>,
	};
}

// ─── Sanitization ────────────────────────────────────────────────────────────

export function sanitizeString(input: string, maxLength: number = 10000): string {
	return input.slice(0, maxLength).trim();
}

export function sanitizeHtml(input: string): string {
	return input
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#x27;');
}
