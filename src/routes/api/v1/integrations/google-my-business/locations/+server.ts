import type { RequestHandler } from './$types';
import { apiError, apiSuccess, requireIntegrationRestaurant } from '$api/helpers';
import { schema } from '$db';
import { getProviderConfig, resolveCredentials } from '$lib/server/integrations/registry';
import { ensureValidToken } from '$lib/server/integrations/token-manager';
import { listLocations } from '$lib/server/integrations/google-my-business/client';

export const GET: RequestHandler = async (event) => {
	const accountName = event.url.searchParams.get('account');
	if (!accountName) return apiError('account query parameter is required', 400);

	const result = await requireIntegrationRestaurant(event, 'google-my-business');
	if (result instanceof Response) return result;
	const { integration } = result;

	const db = event.locals.db;
	const config = getProviderConfig('google-my-business')!;
	const env = (event.platform?.env ?? {}) as Record<string, string | undefined>;
	const credentials = resolveCredentials(config, env);
	if (!credentials) return apiError('Integration not configured', 503);

	const integ = integration as typeof schema.partnerIntegrations.$inferSelect;
	const accessToken = await ensureValidToken(db, integ, config, credentials);
	const locations = await listLocations(accessToken, accountName);

	return apiSuccess({ locations });
};
