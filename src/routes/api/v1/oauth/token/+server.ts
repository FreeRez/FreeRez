import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { eq, and } from 'drizzle-orm';
import { apiClients, apiTokens } from '$lib/server/control-plane/schema';
import { apiError } from '$api/helpers';

export const GET: RequestHandler = async ({ request, locals, url }) => {
	const grantType = url.searchParams.get('grant_type');
	if (grantType !== 'client_credentials') {
		return apiError('grant_type must be client_credentials', 400);
	}

	const authHeader = request.headers.get('Authorization');
	if (!authHeader?.startsWith('Basic ')) {
		return apiError('Missing or invalid Authorization header', 401);
	}

	const decoded = atob(authHeader.slice(6));
	const [clientId, clientSecret] = decoded.split(':');

	if (!clientId || !clientSecret) {
		return apiError('Invalid client credentials', 401);
	}

	const cpDb = locals.cpDb;

	const clients = await cpDb
		.select()
		.from(apiClients)
		.where(
			and(
				eq(apiClients.clientId, clientId),
				eq(apiClients.clientSecret, clientSecret),
				eq(apiClients.active, true)
			)
		)
		.limit(1);

	if (clients.length === 0) {
		return apiError('Invalid client credentials', 401);
	}

	const client = clients[0];
	const accessToken = `v2-${crypto.randomUUID()}`;
	const expiresInSeconds = 86400 * 23; // ~23 days
	const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

	await cpDb.insert(apiTokens).values({
		clientId: client.id,
		tenantId: client.tenantId,
		accessToken,
		scope: client.scope,
		expiresAt
	});

	return json({
		access_token: accessToken,
		scope: client.scope,
		token_type: 'Bearer',
		expires_in: expiresInSeconds
	});
};

export const POST: RequestHandler = GET;
