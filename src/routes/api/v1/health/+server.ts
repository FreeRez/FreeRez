import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';

export const GET: RequestHandler = async ({ locals }) => {
	const checks: Record<string, { status: string; latency_ms?: number }> = {};

	const cpStart = Date.now();
	try {
		await locals.cpDb.run(sql`SELECT 1`);
		checks.control_plane_db = { status: 'ok', latency_ms: Date.now() - cpStart };
	} catch {
		checks.control_plane_db = { status: 'error', latency_ms: Date.now() - cpStart };
	}

	const dbStart = Date.now();
	try {
		await locals.db.run(sql`SELECT 1`);
		checks.tenant_db = { status: 'ok', latency_ms: Date.now() - dbStart };
	} catch {
		checks.tenant_db = { status: 'error', latency_ms: Date.now() - dbStart };
	}

	const allHealthy = Object.values(checks).every((c) => c.status === 'ok');

	return json(
		{
			status: allHealthy ? 'healthy' : 'degraded',
			version: '1.0.0',
			timestamp: new Date().toISOString(),
			checks
		},
		{ status: allHealthy ? 200 : 503 }
	);
};
