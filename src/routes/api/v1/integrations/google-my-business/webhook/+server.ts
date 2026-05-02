import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { schema } from '$db';
import { eq, and } from 'drizzle-orm';
import { getProviderConfig, resolveCredentials } from '$lib/server/integrations/registry';
import { ensureValidToken } from '$lib/server/integrations/token-manager';
import { syncReviews } from '$lib/server/integrations/google-my-business/review-sync';
import { restaurants } from '$db/schema';
import { log } from '$lib/server/logger';

export const POST: RequestHandler = async (event) => {
	const env = (event.platform?.env ?? {}) as Record<string, string | undefined>;
	const verificationToken = env.GMB_PUBSUB_VERIFICATION_TOKEN;

	const body = await event.request.json().catch(() => null);
	if (!body) return json({ error: 'Invalid body' }, { status: 400 });

	const message = (body as Record<string, unknown>).message as Record<string, unknown> | undefined;
	if (!message) return json({ error: 'No message' }, { status: 400 });

	if (verificationToken) {
		const attrs = message.attributes as Record<string, string> | undefined;
		if (attrs?.token && attrs.token !== verificationToken) {
			return json({ error: 'Invalid verification token' }, { status: 403 });
		}
	}

	const data = message.data as string | undefined;
	if (!data) return json({ ok: true });

	let decoded: Record<string, unknown>;
	try {
		decoded = JSON.parse(atob(data)) as Record<string, unknown>;
	} catch {
		return json({ error: 'Invalid data' }, { status: 400 });
	}

	const locationName = decoded.location as string | undefined;
	if (!locationName) return json({ ok: true });

	log('info', 'gmb.webhook.received', { locationName });

	const db = event.locals.db;
	if (!db) return json({ ok: true });

	const integration = await db
		.select()
		.from(schema.partnerIntegrations)
		.where(
			and(
				eq(schema.partnerIntegrations.partnerId, 'google-my-business'),
				eq(schema.partnerIntegrations.status, 'active'),
				eq(schema.partnerIntegrations.partnerIdentifier, locationName)
			)
		)
		.limit(1);

	if (integration.length === 0) return json({ ok: true });

	const rest = await db
		.select()
		.from(restaurants)
		.where(eq(restaurants.id, integration[0].restaurantId))
		.limit(1);

	if (rest.length === 0) return json({ ok: true });

	const config = getProviderConfig('google-my-business')!;
	const credentials = resolveCredentials(config, env);
	if (!credentials) return json({ ok: true });

	const syncPromise = (async () => {
		try {
			const accessToken = await ensureValidToken(db, integration[0], config, credentials);
			await syncReviews(db, accessToken, locationName, rest[0].id, rest[0].rid);
		} catch (err) {
			log('error', 'gmb.webhook.sync_failed', {
				error: err instanceof Error ? err.message : String(err),
			});
		}
	})();

	event.platform?.context?.waitUntil(syncPromise);

	return json({ ok: true });
};
