import type { SmsAdapter, SmsMessage } from '../types';

/**
 * Generic HTTP SMS adapter for Telnyx, Bandwidth, or any SMS API
 * that accepts a JSON POST with { to, from, text } fields.
 *
 * Configure via environment variables:
 *   SMS_API_URL       — The HTTP endpoint
 *   SMS_API_KEY       — The API key
 *   SMS_FROM_NUMBER   — Default sender number
 */
export class HttpSmsAdapter implements SmsAdapter {
	private apiUrl: string;
	private apiKey: string;
	private fromNumber: string;

	constructor(apiUrl: string, apiKey: string, fromNumber: string) {
		this.apiUrl = apiUrl;
		this.apiKey = apiKey;
		this.fromNumber = fromNumber;
	}

	async send(message: SmsMessage): Promise<{ success: boolean; messageId?: string; error?: string }> {
		try {
			const response = await fetch(this.apiUrl, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${this.apiKey}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					to: message.to,
					from: message.from ?? this.fromNumber,
					text: message.body,
					body: message.body
				})
			});

			if (response.ok) {
				const data = await response.json().catch(() => ({})) as Record<string, unknown>;
				return {
					success: true,
					messageId: (data.id as string) ?? (data.sid as string) ?? crypto.randomUUID()
				};
			}

			const errorText = await response.text().catch(() => 'Unknown error');
			return { success: false, error: `${response.status}: ${errorText}` };
		} catch (err) {
			return {
				success: false,
				error: err instanceof Error ? err.message : 'SMS delivery failed'
			};
		}
	}
}
