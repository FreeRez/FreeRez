import type { RequestHandler, RequestEvent } from './$types';
import { sql, lt } from 'drizzle-orm';
import { apiTokens } from '$lib/server/control-plane/schema';
import { slotLocks } from '$db/schema';
import { cleanupExpiredIdempotencyKeys } from '$api/idempotency';
import { apiError, apiSuccess } from '$api/helpers';

function requireAdmin(event: RequestEvent): boolean {
	const key = event.request.headers.get('X-Admin-Key');
	const expected = (event.platform?.env as unknown as Record<string, string>)?.ADMIN_API_KEY;
	if (!expected || !key || key !== expected) return false;
	return true;
}

export const POST: RequestHandler = async (event) => {
	if (!requireAdmin(event)) return apiError('Unauthorized', 401);

	const cpDb = event.locals.cpDb;
	const db = event.locals.db;
	const now = new Date().toISOString();
	const results: Record<string, number> = {};

	const expiredTokens = await cpDb
		.delete(apiTokens)
		.where(sql`${apiTokens.expiresAt} < ${now}`)
		.returning({ id: apiTokens.id });
	results.expired_tokens = expiredTokens.length;

	const expiredLocks = await db
		.delete(slotLocks)
		.where(lt(slotLocks.expiresAt, now))
		.returning({ id: slotLocks.id });
	results.expired_slot_locks = expiredLocks.length;

	results.expired_idempotency_keys = await cleanupExpiredIdempotencyKeys(cpDb);

	return apiSuccess({
		action: 'maintenance',
		cleaned: results,
		timestamp: now
	});
};
