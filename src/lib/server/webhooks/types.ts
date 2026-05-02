export type WebhookEvent =
	| 'reservation.created'
	| 'reservation.updated'
	| 'reservation.cancelled'
	| 'reservation.seated'
	| 'reservation.completed'
	| 'reservation.noshow'
	| 'guest.created'
	| 'guest.updated';

export type WebhookDeliveryRequest = {
	deliveryId: string;
	subscriptionId: string;
	url: string;
	secret: string | null;
	event: WebhookEvent;
	payload: Record<string, unknown>;
	attempt: number;
	maxAttempts: number;
};

export type WebhookDeliveryResult = {
	deliveryId: string;
	subscriptionId: string;
	statusCode: number | null;
	responseBody: string | null;
	delivered: boolean;
	attempt: number;
};

// Retry schedule: 1min, 5min, 30min, 2hr, 24hr
export const RETRY_DELAYS_MS = [
	60 * 1000,
	5 * 60 * 1000,
	30 * 60 * 1000,
	2 * 60 * 60 * 1000,
	24 * 60 * 60 * 1000
];

export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1; // first attempt + retries

export interface WebhookDeliveryAdapter {
	enqueue(request: WebhookDeliveryRequest): Promise<void>;
}
