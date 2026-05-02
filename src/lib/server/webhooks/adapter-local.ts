import type { WebhookDeliveryAdapter, WebhookDeliveryRequest } from './types';
import { RETRY_DELAYS_MS, MAX_ATTEMPTS } from './types';
import { executeDelivery } from './deliver';

/**
 * Local/Docker adapter: In-process queue with setTimeout-based retries.
 * Deliveries are lost on process restart — acceptable for self-hosted
 * since the webhook_deliveries table serves as the audit log and
 * failed deliveries can be replayed from it.
 */
export class LocalWebhookAdapter implements WebhookDeliveryAdapter {
	async enqueue(request: WebhookDeliveryRequest): Promise<void> {
		this.attemptDelivery(request);
	}

	private async attemptDelivery(request: WebhookDeliveryRequest): Promise<void> {
		const result = await executeDelivery(request);

		if (result.delivered) return;

		if (request.attempt < MAX_ATTEMPTS && request.attempt <= RETRY_DELAYS_MS.length) {
			const delay = RETRY_DELAYS_MS[request.attempt - 1];
			setTimeout(() => {
				this.attemptDelivery({
					...request,
					attempt: request.attempt + 1
				});
			}, delay);
		}
	}
}
