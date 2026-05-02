/**
 * WebhookDeliveryDO — Durable Object using the Hibernation API for reliable
 * webhook delivery with exponential backoff retries.
 *
 * Each DO instance handles deliveries for a single webhook subscription.
 * The Worker enqueues deliveries by sending a request to the DO, which
 * persists the delivery, attempts it immediately, and schedules retries
 * via alarm() if it fails.
 *
 * Hibernation: Between alarms, the DO hibernates (no memory, no billing).
 * State is persisted in the DO's transactional storage. When the alarm
 * fires, Cloudflare wakes the DO, it reads its pending deliveries from
 * storage, retries them, and either clears them (success) or reschedules
 * (failure).
 */

import { executeDelivery } from './deliver';
import { RETRY_DELAYS_MS, MAX_ATTEMPTS, type WebhookDeliveryRequest } from './types';

type StoredDelivery = WebhookDeliveryRequest & {
	createdAt: string;
	lastAttemptAt: string | null;
	lastStatusCode: number | null;
};

export class WebhookDeliveryDO {
	private state: DurableObjectState;

	constructor(state: DurableObjectState) {
		this.state = state;
	}

	async fetch(request: Request): Promise<Response> {
		if (request.method !== 'POST') {
			return new Response('Method not allowed', { status: 405 });
		}

		const delivery = (await request.json()) as WebhookDeliveryRequest;
		const stored: StoredDelivery = {
			...delivery,
			createdAt: new Date().toISOString(),
			lastAttemptAt: null,
			lastStatusCode: null
		};

		await this.state.storage.put(`delivery:${delivery.deliveryId}`, stored);

		// Attempt immediately
		const result = await executeDelivery(delivery);

		if (result.delivered) {
			await this.state.storage.delete(`delivery:${delivery.deliveryId}`);
			return Response.json({ delivered: true, statusCode: result.statusCode });
		}

		// First attempt failed — update storage and schedule retry
		stored.attempt = 1;
		stored.lastAttemptAt = new Date().toISOString();
		stored.lastStatusCode = result.statusCode;
		await this.state.storage.put(`delivery:${delivery.deliveryId}`, stored);

		await this.scheduleNextAlarm();

		return Response.json({
			delivered: false,
			statusCode: result.statusCode,
			nextRetry: RETRY_DELAYS_MS[0]
		});
	}

	async alarm(): Promise<void> {
		const entries = await this.state.storage.list<StoredDelivery>({
			prefix: 'delivery:'
		});

		let hasRemaining = false;

		for (const [key, stored] of entries) {
			if (stored.attempt >= MAX_ATTEMPTS) {
				await this.state.storage.delete(key);
				continue;
			}

			const result = await executeDelivery({
				deliveryId: stored.deliveryId,
				subscriptionId: stored.subscriptionId,
				url: stored.url,
				secret: stored.secret,
				event: stored.event,
				payload: stored.payload,
				attempt: stored.attempt + 1,
				maxAttempts: stored.maxAttempts
			});

			if (result.delivered) {
				await this.state.storage.delete(key);
			} else {
				stored.attempt = result.attempt;
				stored.lastAttemptAt = new Date().toISOString();
				stored.lastStatusCode = result.statusCode;
				await this.state.storage.put(key, stored);

				if (stored.attempt < MAX_ATTEMPTS) {
					hasRemaining = true;
				} else {
					await this.state.storage.delete(key);
				}
			}
		}

		if (hasRemaining) {
			await this.scheduleNextAlarm();
		}
		// If no remaining deliveries, DO hibernates — no alarm, no billing.
	}

	private async scheduleNextAlarm(): Promise<void> {
		const entries = await this.state.storage.list<StoredDelivery>({
			prefix: 'delivery:'
		});

		let earliestRetry = Infinity;

		for (const [, stored] of entries) {
			if (stored.attempt < RETRY_DELAYS_MS.length) {
				const delay = RETRY_DELAYS_MS[stored.attempt];
				earliestRetry = Math.min(earliestRetry, delay);
			}
		}

		if (earliestRetry < Infinity) {
			await this.state.storage.setAlarm(Date.now() + earliestRetry);
		}
	}
}
