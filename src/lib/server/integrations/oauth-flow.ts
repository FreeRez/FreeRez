import type { OAuthProviderConfig, OAuthCredentials, OAuthTokenResult, OAuthState } from './types';

export function buildAuthorizeUrl(
	config: OAuthProviderConfig,
	credentials: OAuthCredentials,
	redirectUri: string,
	state: OAuthState
): string {
	const params = new URLSearchParams({
		client_id: credentials.clientId,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: config.scopes.join(' '),
		state: encodeState(state),
		...config.extraAuthParams,
	});
	return `${config.authorizeUrl}?${params.toString()}`;
}

export function encodeState(state: OAuthState): string {
	return btoa(JSON.stringify(state));
}

export function decodeState(encoded: string): OAuthState | null {
	try {
		return JSON.parse(atob(encoded)) as OAuthState;
	} catch {
		return null;
	}
}

export async function exchangeCodeForTokens(
	config: OAuthProviderConfig,
	credentials: OAuthCredentials,
	code: string,
	redirectUri: string
): Promise<OAuthTokenResult> {
	const body = new URLSearchParams({
		grant_type: 'authorization_code',
		code,
		client_id: credentials.clientId,
		client_secret: credentials.clientSecret,
		redirect_uri: redirectUri,
		...config.extraTokenParams,
	});

	const response = await fetch(config.tokenUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: body.toString(),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Token exchange failed (${response.status}): ${text}`);
	}

	const data = (await response.json()) as {
		access_token: string;
		refresh_token?: string;
		expires_in: number;
		token_type: string;
		scope?: string;
	};

	return {
		accessToken: data.access_token,
		refreshToken: data.refresh_token,
		expiresIn: data.expires_in,
		tokenType: data.token_type,
		scope: data.scope,
	};
}

export async function refreshAccessToken(
	config: OAuthProviderConfig,
	credentials: OAuthCredentials,
	refreshToken: string
): Promise<OAuthTokenResult> {
	const body = new URLSearchParams({
		grant_type: 'refresh_token',
		refresh_token: refreshToken,
		client_id: credentials.clientId,
		client_secret: credentials.clientSecret,
	});

	const response = await fetch(config.tokenUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: body.toString(),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Token refresh failed (${response.status}): ${text}`);
	}

	const data = (await response.json()) as {
		access_token: string;
		refresh_token?: string;
		expires_in: number;
		token_type: string;
		scope?: string;
	};

	return {
		accessToken: data.access_token,
		refreshToken: data.refresh_token ?? refreshToken,
		expiresIn: data.expires_in,
		tokenType: data.token_type,
		scope: data.scope,
	};
}

export async function revokeToken(
	config: OAuthProviderConfig,
	token: string
): Promise<boolean> {
	if (!config.revokeUrl) return false;

	const response = await fetch(config.revokeUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ token }).toString(),
	});

	return response.ok;
}

export function computeRedirectUri(origin: string, providerId: string): string {
	return `${origin}/api/v1/integrations/${providerId}/callback`;
}
