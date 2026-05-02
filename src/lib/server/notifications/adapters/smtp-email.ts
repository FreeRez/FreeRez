import type { EmailAdapter, EmailMessage } from '../types';

/**
 * HTTP email adapter — supports any email API that accepts JSON POST requests.
 *
 * Works with: Resend, Postmark, Mailgun, SendGrid, or any HTTP relay.
 *
 *   EMAIL_API_URL    — The HTTP endpoint (e.g., https://api.resend.com/emails)
 *   EMAIL_API_KEY    — API key
 *   EMAIL_FROM       — Default sender address
 *
 * For self-hosted SMTP: Use a local HTTP relay like MailHog or
 * configure a service like Resend/Postmark (free tier available).
 *
 * For direct SMTP in Docker (Node.js runtime): Install nodemailer
 * and use SmtpEmailAdapter below instead.
 */
export class HttpEmailAdapter implements EmailAdapter {
	private apiUrl: string;
	private apiKey: string;
	private defaultFrom: string;

	constructor(apiUrl: string, apiKey: string, defaultFrom: string) {
		this.apiUrl = apiUrl;
		this.apiKey = apiKey;
		this.defaultFrom = defaultFrom;
	}

	async send(message: EmailMessage): Promise<{ success: boolean; messageId?: string; error?: string }> {
		try {
			const response = await fetch(this.apiUrl, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${this.apiKey}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					from: message.from ?? this.defaultFrom,
					to: message.to,
					subject: message.subject,
					html: message.html,
					text: message.text,
					reply_to: message.replyTo
				})
			});

			if (response.ok) {
				const data = await response.json().catch(() => ({})) as Record<string, unknown>;
				return {
					success: true,
					messageId: (data.id as string) ?? (data.messageId as string) ?? crypto.randomUUID()
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

/**
 * Direct SMTP adapter for Node.js/Docker deployments.
 * Uses nodemailer — only available in non-Cloudflare environments.
 *
 *   SMTP_HOST     — SMTP server hostname
 *   SMTP_PORT     — SMTP port (587 for STARTTLS, 465 for SSL)
 *   SMTP_USER     — SMTP username
 *   SMTP_PASS     — SMTP password
 *   EMAIL_FROM    — Default sender address
 *
 * Install: npm install nodemailer @types/nodemailer
 */
export class SmtpEmailAdapter implements EmailAdapter {
	private config: {
		host: string;
		port: number;
		user: string;
		pass: string;
		from: string;
	};

	constructor(host: string, port: number, user: string, pass: string, from: string) {
		this.config = { host, port, user, pass, from };
	}

	async send(message: EmailMessage): Promise<{ success: boolean; messageId?: string; error?: string }> {
		try {
			// Dynamic import to avoid bundling in Cloudflare
			// @ts-expect-error nodemailer is only available in Node.js/Docker
			const nodemailer = await import('nodemailer');
			const transport = nodemailer.createTransport({
				host: this.config.host,
				port: this.config.port,
				secure: this.config.port === 465,
				auth: {
					user: this.config.user,
					pass: this.config.pass
				}
			});

			const result = await transport.sendMail({
				from: message.from ?? this.config.from,
				to: message.to,
				subject: message.subject,
				html: message.html,
				text: message.text,
				replyTo: message.replyTo
			});

			return { success: true, messageId: result.messageId };
		} catch (err) {
			return {
				success: false,
				error: err instanceof Error ? err.message : 'SMTP delivery failed'
			};
		}
	}
}
