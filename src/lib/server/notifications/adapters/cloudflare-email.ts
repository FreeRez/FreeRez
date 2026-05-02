import type { EmailAdapter, EmailMessage } from '../types';

/**
 * Cloudflare Email Service adapter.
 * Uses the REST API: POST /accounts/{account_id}/email/sending/send
 *
 * Requires:
 *   CF_ACCOUNT_ID    — Cloudflare account ID
 *   CF_EMAIL_TOKEN   — API token with email send permission
 *   EMAIL_FROM       — Sender address (domain must be onboarded in CF)
 *
 * @see https://developers.cloudflare.com/email-service/get-started/send-emails/
 */
export class CloudflareEmailAdapter implements EmailAdapter {
	private accountId: string;
	private apiToken: string;
	private defaultFrom: string;

	constructor(accountId: string, apiToken: string, defaultFrom: string) {
		this.accountId = accountId;
		this.apiToken = apiToken;
		this.defaultFrom = defaultFrom;
	}

	async send(message: EmailMessage): Promise<{ success: boolean; messageId?: string; error?: string }> {
		try {
			const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/email/sending/send`;

			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${this.apiToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					to: message.to,
					from: message.from ?? this.defaultFrom,
					subject: message.subject,
					html: message.html,
					text: message.text
				})
			});

			if (response.ok) {
				const data = await response.json().catch(() => ({})) as Record<string, unknown>;
				return {
					success: true,
					messageId: (data.result as Record<string, unknown>)?.id as string ?? crypto.randomUUID()
				};
			}

			const errorText = await response.text().catch(() => 'Unknown error');
			return { success: false, error: `${response.status}: ${errorText}` };
		} catch (err) {
			return {
				success: false,
				error: err instanceof Error ? err.message : 'Email delivery failed'
			};
		}
	}
}
