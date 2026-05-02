import type { Database } from '$db';
import { schema } from '$db';
import { eq } from 'drizzle-orm';
import type { OAuthProviderConfig, OAuthCredentials, OAuthTokenResult } from './types';
import { refreshAccessToken } from './oauth-flow';

const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

type Integration = typeof schema.partnerIntegrations.$inferSelect;

export async function ensureValidToken(
	db: Database,
	integration: Integration,
	config: OAuthProviderConfig,
	credentials: OAuthCredentials
): Promise<string> {
	if (!integration.accessToken || !integration.refreshToken) {
		throw new Error('Integration has no tokens');
	}

	const expiresAt = integration.tokenExpiresAt
		? new Date(integration.tokenExpiresAt).getTime()
		: 0;

	if (expiresAt - TOKEN_EXPIRY_BUFFER_MS > Date.now()) {
		return integration.accessToken;
	}

	const result = await refreshAccessToken(config, credentials, integration.refreshToken);
	await updateIntegrationTokens(db, integration.id, result);
	return result.accessToken;
}

export async function updateIntegrationTokens(
	db: Database,
	integrationId: string,
	tokens: OAuthTokenResult
): Promise<void> {
	const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000).toISOString();

	await db
		.update(schema.partnerIntegrations)
		.set({
			accessToken: tokens.accessToken,
			refreshToken: tokens.refreshToken,
			tokenExpiresAt: expiresAt,
			updatedAt: new Date().toISOString(),
		})
		.where(eq(schema.partnerIntegrations.id, integrationId));
}

export async function storeIntegrationTokens(
	db: Database,
	integrationId: string,
	tokens: OAuthTokenResult,
	partnerIdentifier?: string,
	metadata?: Record<string, unknown>
): Promise<void> {
	const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000).toISOString();

	const updateData: Record<string, unknown> = {
		accessToken: tokens.accessToken,
		refreshToken: tokens.refreshToken ?? null,
		tokenExpiresAt: expiresAt,
		status: 'active',
		updatedAt: new Date().toISOString(),
	};

	if (partnerIdentifier) {
		updateData.partnerIdentifier = partnerIdentifier;
	}
	if (metadata) {
		updateData.metadata = metadata;
	}

	await db
		.update(schema.partnerIntegrations)
		.set(updateData)
		.where(eq(schema.partnerIntegrations.id, integrationId));
}
