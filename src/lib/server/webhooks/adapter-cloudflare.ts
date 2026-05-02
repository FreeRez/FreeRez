import type { WebhookDeliveryAdapter, WebhookDeliveryRequest } from './types';

/**
 * Cloudflare adapter: Routes each delivery to a Durable Object keyed by
 * subscription ID. The DO handles immediate delivery + retry via alarms.
 */
export class CloudflareWebhookAdapter implements WebhookDeliveryAdapter {
	private namespace: DurableObjectNamespace;

	constructor(namespace: DurableObjectNamespace) {
		this.namespace = namespace;
	}

	async enqueue(request: WebhookDeliveryRequest): Promise<void> {
		const doId = this.namespace.idFromName(request.subscriptionId);
		const stub = this.namespace.get(doId);

		await stub.fetch('https://internal/deliver', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(request)
		});
	}
}
