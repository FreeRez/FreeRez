import { eq, and, lt } from 'drizzle-orm';
import { idempotencyKeys } from '$lib/server/control-plane/schema';
import type { ControlPlaneDatabase } from '$lib/server/control-plane';

const TTL_MS = 24 * 60 * 60 * 1000;

export async function checkIdempotency(
	cpDb: ControlPlaneDatabase,
	clientId: string,
	requestId: string
): Promise<{ hit: true; statusCode: number; body: string } | { hit: false }> {
	const existing = await cpDb
		.select()
		.from(idempotencyKeys)
		.where(
			and(
				eq(idempotencyKeys.clientId, clientId),
				eq(idempotencyKeys.requestId, requestId)
			)
		)
		.limit(1);

	if (existing.length === 0) return { hit: false };

	const entry = existing[0];
	const age = Date.now() - new Date(entry.createdAt).getTime();
	if (age > TTL_MS) {
		await cpDb
			.delete(idempotencyKeys)
			.where(eq(idempotencyKeys.id, entry.id));
		return { hit: false };
	}

	return { hit: true, statusCode: entry.statusCode, body: entry.responseBody };
}

export async function storeIdempotency(
	cpDb: ControlPlaneDatabase,
	clientId: string,
	requestId: string,
	method: string,
	path: string,
	statusCode: number,
	body: string
): Promise<void> {
	await cpDb
		.insert(idempotencyKeys)
		.values({
			clientId,
			requestId,
			method,
			path,
			statusCode,
			responseBody: body,
			createdAt: new Date().toISOString()
		})
		.onConflictDoNothing();
}

export async function cleanupExpiredIdempotencyKeys(
	cpDb: ControlPlaneDatabase
): Promise<number> {
	const cutoff = new Date(Date.now() - TTL_MS).toISOString();
	const deleted = await cpDb
		.delete(idempotencyKeys)
		.where(lt(idempotencyKeys.createdAt, cutoff))
		.returning({ id: idempotencyKeys.id });
	return deleted.length;
}
