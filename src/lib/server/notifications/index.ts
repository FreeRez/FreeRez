export type {
	EmailAdapter,
	SmsAdapter,
	NotificationService,
	EmailMessage,
	SmsMessage,
	ReservationContext,
	NotificationEvent
} from './types';

export { CloudflareEmailAdapter } from './adapters/cloudflare-email';
export { HttpEmailAdapter, SmtpEmailAdapter } from './adapters/smtp-email';
export { TwilioSmsAdapter } from './adapters/twilio-sms';
export { HttpSmsAdapter } from './adapters/http-sms';

export {
	reservationConfirmedEmail,
	reservationCancelledEmail,
	reservationModifiedEmail,
	reservationConfirmedSms,
	reservationCancelledSms,
	reservationReminderSms
} from './templates';
