import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthContext } from '$api/helpers';
import { MCP_TOOLS } from '$lib/server/mcp/tools';
import { executeToolCall } from '$lib/server/mcp/handlers';

// ─── JSON-RPC Types ─────────────────────────────────────────────────────────

type JsonRpcRequest = {
	jsonrpc: '2.0';
	id?: string | number | null;
	method: string;
	params?: Record<string, unknown>;
};

type JsonRpcResponse = {
	jsonrpc: '2.0';
	id: string | number | null;
	result?: unknown;
	error?: { code: number; message: string; data?: unknown };
};

// ─── JSON-RPC Error Codes ───────────────────────────────────────────────────

const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

function rpcError(
	id: string | number | null,
	code: number,
	message: string,
	data?: unknown
): JsonRpcResponse {
	return { jsonrpc: '2.0', id, error: { code, message, ...(data !== undefined ? { data } : {}) } };
}

function rpcSuccess(id: string | number | null, result: unknown): JsonRpcResponse {
	return { jsonrpc: '2.0', id, result };
}

// ─── MCP Server Info ────────────────────────────────────────────────────────

const SERVER_INFO = {
	protocolVersion: '2025-03-26',
	capabilities: {
		tools: { listChanged: false }
	},
	serverInfo: {
		name: 'freerez-mcp',
		version: '1.0.0'
	}
};

// ─── POST Handler ───────────────────────────────────────────────────────────

export const POST: RequestHandler = async (event) => {
	// Authenticate via Bearer token (same as all other endpoints)
	const auth = getAuthContext(event);
	if (!auth) {
		return json(rpcError(null, INVALID_REQUEST, 'Unauthorized: missing or invalid Bearer token'), {
			status: 401
		});
	}

	const db = event.locals.db;

	// Parse JSON-RPC request body
	let body: JsonRpcRequest;
	try {
		const text = await event.request.text();
		if (!text) {
			return json(rpcError(null, PARSE_ERROR, 'Empty request body'), { status: 400 });
		}
		body = JSON.parse(text) as JsonRpcRequest;
	} catch {
		return json(rpcError(null, PARSE_ERROR, 'Invalid JSON'), { status: 400 });
	}

	// Validate JSON-RPC structure
	if (body.jsonrpc !== '2.0' || !body.method) {
		return json(rpcError(body.id ?? null, INVALID_REQUEST, 'Invalid JSON-RPC 2.0 request'), {
			status: 400
		});
	}

	const id = body.id ?? null;

	// ─── Route to method handler ──────────────────────────────────────────────

	let response: JsonRpcResponse;

	switch (body.method) {
		case 'initialize': {
			response = rpcSuccess(id, SERVER_INFO);
			break;
		}

		case 'ping': {
			response = rpcSuccess(id, {});
			break;
		}

		case 'notifications/initialized': {
			// Client acknowledgement - no response needed for notifications, but
			// since we receive this as a POST we return an empty success
			response = rpcSuccess(id, {});
			break;
		}

		case 'tools/list': {
			response = rpcSuccess(id, { tools: MCP_TOOLS });
			break;
		}

		case 'tools/call': {
			const params = body.params;
			if (!params || typeof params.name !== 'string') {
				response = rpcError(id, INVALID_PARAMS, 'params.name is required');
				break;
			}

			const toolName = params.name;
			const toolArgs = (params.arguments ?? {}) as Record<string, unknown>;

			// Validate the tool exists
			const toolDef = MCP_TOOLS.find((t) => t.name === toolName);
			if (!toolDef) {
				response = rpcError(id, METHOD_NOT_FOUND, `Unknown tool: ${toolName}`);
				break;
			}

			// Validate required params
			const missingParams = toolDef.inputSchema.required.filter(
				(p) => toolArgs[p] === undefined || toolArgs[p] === null
			);
			if (missingParams.length > 0) {
				response = rpcError(
					id,
					INVALID_PARAMS,
					`Missing required parameters: ${missingParams.join(', ')}`
				);
				break;
			}

			// Every tool requires an `rid` - check authorization
			const rid = toolArgs.rid as number | undefined;
			if (rid !== undefined) {
				if (
					auth.allowedRids &&
					auth.allowedRids.length > 0 &&
					!auth.allowedRids.includes(rid)
				) {
					response = rpcError(id, INVALID_PARAMS, 'Permission denied for this restaurant');
					break;
				}
			}

			// Execute the tool
			try {
				const result = await executeToolCall(toolName, toolArgs, db);
				response = rpcSuccess(id, result);
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Internal error';
				response = rpcError(id, INTERNAL_ERROR, message);
			}
			break;
		}

		default: {
			response = rpcError(id, METHOD_NOT_FOUND, `Unknown method: ${body.method}`);
		}
	}

	return json(response, {
		status: 200,
		headers: {
			'Content-Type': 'application/json'
		}
	});
};
