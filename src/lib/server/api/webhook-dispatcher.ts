import { eq, and } from 'drizzle-orm';
import { webhookSubscriptions, webhookDeliveries } from '$db/schema';
import type { Database } from '$db';
import type { WebhookEvent, WebhookDeliveryAdapter } from '$lib/server/webhooks/types';
import { MAX_ATTEMPTS } from '$lib/server/webhooks/types';

export type { WebhookEvent };

export async function dispatchWebhook(
	db: Database,
	restaurantId: string,
	event: WebhookEvent,
	payload: Record<string, unknown>,
	adapter?: WebhookDeliveryAdapter
): Promise<void> {
	const subscriptions = await db
		.select()
		.from(webhookSubscriptions)
		.where(
			and(
				eq(webhookSubscriptions.restaurantId, restaurantId),
				eq(webhookSubscriptions.active, true)
			)
		);

	const matchingSubscriptions = subscriptions.filter((sub) => {
		const events = sub.events as string[];
		return events.includes(event);
	});

	for (const sub of matchingSubscriptions) {
		const deliveryId = crypto.randomUUID();

		// Record the delivery attempt in the audit log
		await db.insert(webhookDeliveries).values({
			id: deliveryId,
			subscriptionId: sub.id,
			event,
			payload,
			statusCode: null,
			responseBody: null,
			attempts: 0,
			deliveredAt: null,
			createdAt: new Date().toISOString()
		});

		const request = {
			deliveryId,
			subscriptionId: sub.id,
			url: sub.url,
			secret: sub.secret,
			event,
			payload,
			attempt: 1,
			maxAttempts: MAX_ATTEMPTS
		};

		if (adapter) {
			// Use the platform-specific adapter (DO on Cloudflare, queue on Docker)
			await adapter.enqueue(request);
		} else {
			// Fallback: direct delivery (no retries)
			const { executeDelivery } = await import('$lib/server/webhooks/deliver');
			const result = await executeDelivery(request);

			await db
				.update(webhookDeliveries)
				.set({
					statusCode: result.statusCode,
					responseBody: result.responseBody,
					attempts: 1,
					deliveredAt: result.delivered ? new Date().toISOString() : null
				})
				.where(eq(webhookDeliveries.id, deliveryId));
		}
	}
}
