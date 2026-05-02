import type { SmsAdapter, SmsMessage } from '../types';

/**
 * Twilio SMS adapter. Supports both Account auth and API Key auth.
 *
 * Account auth:
 *   TWILIO_ACCOUNT_SID  — Account SID (ACxxxx)
 *   TWILIO_AUTH_TOKEN    — Account auth token
 *
 * API Key auth:
 *   TWILIO_ACCOUNT_SID  — Account SID (ACxxxx) for the URL
 *   TWILIO_AUTH_TOKEN    — API Key SID (SKxxxx):API Key Secret
 *   (or set TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET separately)
 *
 *   TWILIO_FROM_NUMBER   — Twilio phone number to send from
 */
export class TwilioSmsAdapter implements SmsAdapter {
	private accountSid: string;
	private authUsername: string;
	private authPassword: string;
	private fromNumber: string;

	constructor(config: {
		accountSid: string;
		authToken?: string;
		apiKeySid?: string;
		apiKeySecret?: string;
		fromNumber: string;
	}) {
		this.accountSid = config.accountSid;
		this.fromNumber = config.fromNumber;

		if (config.apiKeySid && config.apiKeySecret) {
			this.authUsername = config.apiKeySid;
			this.authPassword = config.apiKeySecret;
		} else {
			this.authUsername = config.accountSid;
			this.authPassword = config.authToken ?? '';
		}
	}

	async send(message: SmsMessage): Promise<{ success: boolean; messageId?: string; error?: string }> {
		try {
			const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;

			const body = new URLSearchParams({
				To: message.to,
				From: message.from ?? this.fromNumber,
				Body: message.body
			});

			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Authorization': `Basic ${btoa(`${this.authUsername}:${this.authPassword}`)}`,
					'Content-Type': 'application/x-www-form-urlencoded'
				},
				body: body.toString()
			});

			if (response.ok) {
				const data = await response.json() as Record<string, unknown>;
				return { success: true, messageId: data.sid as string };
			}

			const errorData = await response.json().catch(() => ({})) as Record<string, unknown>;
			return { success: false, error: (errorData.message as string) ?? `${response.status}` };
		} catch (err) {
			return {
				success: false,
				error: err instanceof Error ? err.message : 'SMS delivery failed'
			};
		}
	}
}
