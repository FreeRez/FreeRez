import type { RequestHandler } from './$types';
import { redirect } from '@sveltejs/kit';
import { getProviderConfig, resolveCredentialsFromDb } from '$lib/server/integrations/registry';
import { decodeState, exchangeCodeForTokens, computeRedirectUri } from '$lib/server/integrations/oauth-flow';
import { storeIntegrationTokens } from '$lib/server/integrations/token-manager';
import { apiError } from '$api/helpers';
import { schema } from '$db';
import { eq, and } from 'drizzle-orm';
import { log } from '$lib/server/logger';

export const GET: RequestHandler = async (event) => {
	const providerId = event.params.provider;
	if (!providerId) return apiError('Provider is required', 400);

	const config = getProviderConfig(providerId);
	if (!config) return apiError('Unknown provider', 404);

	const env = (event.platform?.env ?? {}) as Record<string, string | undefined>;
	const credentials = await resolveCredentialsFromDb(config, event.locals.cpDb, env);
	if (!credentials) return apiError('Integration not configured', 503);

	const db = event.locals.db;
	if (!db) return apiError('Database unavailable', 503);

	const code = event.url.searchParams.get('code');
	const stateParam = event.url.searchParams.get('state');
	const error = event.url.searchParams.get('error');

	if (error) {
		log('warn', 'integration.oauth.denied', { providerId, error });
		return redirect(302, '/dashboard/settings?error=oauth_denied');
	}

	if (!code || !stateParam) {
		return apiError('Missing code or state parameter', 400);
	}

	const state = decodeState(stateParam);
	if (!state || state.providerId !== providerId) {
		return apiError('Invalid state parameter', 400);
	}

	const integration = await db
		.select()
		.from(schema.partnerIntegrations)
		.where(
			and(
				eq(schema.partnerIntegrations.restaurantId, state.restaurantId),
				eq(schema.partnerIntegrations.partnerId, providerId),
				eq(schema.partnerIntegrations.status, 'pending')
			)
		)
		.limit(1);

	if (integration.length === 0) {
		return apiError('No pending integration found', 400);
	}

	const storedMetadata = integration[0].metadata as Record<string, unknown> | null;
	if (!storedMetadata || storedMetadata.nonce !== state.nonce) {
		return apiError('Invalid nonce', 400);
	}

	if (event.locals.user && state.userId !== event.locals.user.id) {
		return apiError('User mismatch', 403);
	}

	const redirectUri =
		env.GMB_REDIRECT_URI ?? computeRedirectUri(event.url.origin, providerId);

	try {
		const tokens = await exchangeCodeForTokens(config, credentials, code, redirectUri);

		await storeIntegrationTokens(db, integration[0].id, tokens, undefined, {
			...storedMetadata,
			nonce: undefined,
			connectedAt: new Date().toISOString(),
		});

		log('info', 'integration.connected', {
			providerId,
			restaurantId: state.restaurantId,
		});

		const returnUrl = new URL(state.returnUrl, event.url.origin);
		returnUrl.searchParams.set('connected', providerId);
		return redirect(302, returnUrl.pathname + returnUrl.search);
	} catch (err) {
		log('error', 'integration.oauth.exchange_failed', {
			providerId,
			error: err instanceof Error ? err.message : String(err),
		});
		return redirect(302, '/dashboard/settings?error=oauth_failed');
	}
};
