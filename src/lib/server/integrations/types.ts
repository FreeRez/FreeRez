import type { Database } from '$db';

export interface OAuthProviderConfig {
	providerId: string;
	displayName: string;
	authorizeUrl: string;
	tokenUrl: string;
	revokeUrl?: string;
	scopes: string[];
	clientIdEnvVar: string;
	clientSecretEnvVar: string;
	extraAuthParams?: Record<string, string>;
	extraTokenParams?: Record<string, string>;
}

export interface OAuthCredentials {
	clientId: string;
	clientSecret: string;
}

export interface OAuthTokenResult {
	accessToken: string;
	refreshToken?: string;
	expiresIn: number;
	tokenType: string;
	scope?: string;
}

export interface OAuthState {
	restaurantId: string;
	providerId: string;
	userId: string;
	nonce: string;
	returnUrl: string;
}

export interface SyncResult {
	synced: number;
	created: number;
	updated: number;
	errors: string[];
}

export interface IntegrationContext {
	db: Database;
	integrationId: string;
	restaurantId: string;
	accessToken: string;
	partnerIdentifier: string;
	metadata: Record<string, unknown>;
}
