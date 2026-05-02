import type { WebhookDeliveryRequest, WebhookDeliveryResult } from './types';

export async function executeDelivery(
	request: WebhookDeliveryRequest
): Promise<WebhookDeliveryResult> {
	const body = JSON.stringify(request.payload);

	const signature = request.secret ? await computeHmac(request.secret, body) : null;

	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		'X-Webhook-Event': request.event,
		'X-Webhook-Delivery': request.deliveryId,
		'X-Webhook-Attempt': String(request.attempt),
		'User-Agent': 'FreeRez-Webhook/1.0'
	};

	if (signature) {
		headers['X-Webhook-Signature'] = signature;
	}

	let statusCode: number | null = null;
	let responseBody: string | null = null;

	try {
		const response = await fetch(request.url, {
			method: 'POST',
			headers,
			body,
			signal: AbortSignal.timeout(10000)
		});

		statusCode = response.status;
		responseBody = await response.text().catch(() => null);
	} catch (err) {
		statusCode = 0;
		responseBody = err instanceof Error ? err.message : 'Delivery failed';
	}

	const delivered = statusCode !== null && statusCode >= 200 && statusCode < 300;

	return {
		deliveryId: request.deliveryId,
		subscriptionId: request.subscriptionId,
		statusCode,
		responseBody: responseBody?.slice(0, 1000) ?? null,
		delivered,
		attempt: request.attempt
	};
}

async function computeHmac(secret: string, body: string): Promise<string> {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
	const bytes = new Uint8Array(sig);
	return `sha256=${Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}
