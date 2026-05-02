import type { OAuthProviderConfig, OAuthCredentials } from './types';
import type { ControlPlaneDatabase } from '$lib/server/control-plane';

const PROVIDERS: Record<string, OAuthProviderConfig> = {
	'google-my-business': {
		providerId: 'google-my-business',
		displayName: 'Google Business Profile',
		authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
		tokenUrl: 'https://oauth2.googleapis.com/token',
		revokeUrl: 'https://oauth2.googleapis.com/revoke',
		scopes: ['https://www.googleapis.com/auth/business.manage'],
		clientIdEnvVar: 'GMB_CLIENT_ID',
		clientSecretEnvVar: 'GMB_CLIENT_SECRET',
		extraAuthParams: { access_type: 'offline', prompt: 'consent' },
	},
};

export function getProviderConfig(providerId: string): OAuthProviderConfig | null {
	return PROVIDERS[providerId] ?? null;
}

export function getAvailableProviders(): OAuthProviderConfig[] {
	return Object.values(PROVIDERS);
}

export function resolveCredentials(
	config: OAuthProviderConfig,
	env: Record<string, string | undefined>
): OAuthCredentials | null {
	const clientId = env[config.clientIdEnvVar];
	const clientSecret = env[config.clientSecretEnvVar];
	if (!clientId || !clientSecret) return null;
	return { clientId, clientSecret };
}

export async function resolveCredentialsFromDb(
	config: OAuthProviderConfig,
	cpDb: ControlPlaneDatabase | null,
	env: Record<string, string | undefined>,
	integrationMetadata?: Record<string, unknown> | null
): Promise<OAuthCredentials | null> {
	// 1. Per-tenant credentials stored in partnerIntegrations.metadata
	if (integrationMetadata) {
		const clientId = integrationMetadata.oauthClientId as string | undefined;
		const clientSecret = integrationMetadata.oauthClientSecret as string | undefined;
		if (clientId && clientSecret) {
			return { clientId, clientSecret };
		}
	}

	// 2. Platform-level credentials from control plane DB
	if (cpDb) {
		const { platformSettings } = await import('$lib/server/control-plane/schema');
		const { eq } = await import('drizzle-orm');

		const [clientIdRow] = await cpDb
			.select()
			.from(platformSettings)
			.where(eq(platformSettings.key, config.clientIdEnvVar))
			.limit(1);

		const [clientSecretRow] = await cpDb
			.select()
			.from(platformSettings)
			.where(eq(platformSettings.key, config.clientSecretEnvVar))
			.limit(1);

		if (clientIdRow?.value && clientSecretRow?.value) {
			return { clientId: clientIdRow.value, clientSecret: clientSecretRow.value };
		}
	}

	// 3. Fallback to environment variables
	return resolveCredentials(config, env);
}
