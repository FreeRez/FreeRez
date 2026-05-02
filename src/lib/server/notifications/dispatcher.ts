import type { NotificationService, ReservationContext } from './types';
import {
	reservationConfirmedEmail,
	reservationCancelledEmail,
	reservationModifiedEmail,
	reservationConfirmedSms,
	reservationCancelledSms
} from './templates';
import { log } from '$lib/server/logger';

export async function notifyReservationConfirmed(
	service: NotificationService,
	ctx: ReservationContext,
	fromEmail: string
): Promise<void> {
	log('info', 'notification.dispatch', {
		event: 'reservation.confirmed',
		hasEmail: !!service.email,
		hasSms: !!service.sms,
		guestEmail: ctx.guestEmail ?? null,
		guestPhone: ctx.guestPhone ?? null
	});

	if (service.email && ctx.guestEmail) {
		const msg = reservationConfirmedEmail(ctx, fromEmail);
		const result = await service.email.send(msg);
		log('info', 'notification.email.sent', {
			event: 'reservation.confirmed',
			to: ctx.guestEmail,
			success: result.success,
			messageId: result.messageId,
			error: result.error
		});
	}

	if (service.sms && ctx.guestPhone) {
		try {
			const msg = reservationConfirmedSms(ctx);
			log('info', 'notification.sms.sending', { to: msg.to, body: msg.body.slice(0, 50) });
			const result = await service.sms.send(msg);
			log('info', 'notification.sms.sent', {
				event: 'reservation.confirmed',
				to: ctx.guestPhone,
				success: result.success,
				messageId: result.messageId,
				error: result.error
			});
		} catch (err) {
			log('error', 'notification.sms.error', {
				to: ctx.guestPhone,
				error: err instanceof Error ? err.message : String(err)
			});
		}
	}
}

export async function notifyReservationCancelled(
	service: NotificationService,
	ctx: ReservationContext,
	fromEmail: string
): Promise<void> {
	if (service.email && ctx.guestEmail) {
		const msg = reservationCancelledEmail(ctx, fromEmail);
		const result = await service.email.send(msg);
		log('info', 'notification.email.sent', {
			event: 'reservation.cancelled',
			to: ctx.guestEmail,
			success: result.success,
			error: result.error
		});
	}

	if (service.sms && ctx.guestPhone) {
		const msg = reservationCancelledSms(ctx);
		const result = await service.sms.send(msg);
		log('info', 'notification.sms.sent', {
			event: 'reservation.cancelled',
			to: ctx.guestPhone,
			success: result.success,
			error: result.error
		});
	}
}

export async function notifyReservationModified(
	service: NotificationService,
	ctx: ReservationContext,
	fromEmail: string
): Promise<void> {
	if (service.email && ctx.guestEmail) {
		const msg = reservationModifiedEmail(ctx, fromEmail);
		const result = await service.email.send(msg);
		log('info', 'notification.email.sent', {
			event: 'reservation.modified',
			to: ctx.guestEmail,
			success: result.success,
			error: result.error
		});
	}
}
