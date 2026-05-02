import type { RequestHandler } from './$types';
import { createAuth } from '$lib/server/auth';

const handleAuth: RequestHandler = async ({ request, locals, url, platform }) => {
	const envRecord = (platform?.env ?? {}) as Record<string, string | undefined>;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const auth = createAuth(locals.db as any, {
		baseURL: url.origin,
		secret: envRecord.BETTER_AUTH_SECRET,
		emailAdapter: locals.notifications?.email,
	});
	return auth.handler(request);
};

export const GET = handleAuth;
export const POST = handleAuth;
