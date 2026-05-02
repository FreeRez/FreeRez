import type { ReservationContext, StaffInviteContext, EmailMessage, SmsMessage } from './types';

export function reservationConfirmedEmail(
	ctx: ReservationContext,
	fromEmail: string
): EmailMessage {
	const date = new Date(ctx.dateTime);
	const dateStr = date.toLocaleDateString('en-US', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
	const timeStr = date.toLocaleTimeString('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	});

	return {
		to: ctx.guestEmail!,
		from: fromEmail,
		subject: `Reservation Confirmed at ${ctx.restaurantName}`,
		html: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #1a1a1a;">Your reservation is confirmed</h2>
  <p>Hi ${ctx.guestFirstName},</p>
  <div style="background: #f8f8f8; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0 0 8px;"><strong>${ctx.restaurantName}</strong></p>
    <p style="margin: 0 0 4px;">${dateStr} at ${timeStr}</p>
    <p style="margin: 0 0 4px;">Party of ${ctx.partySize}</p>
    <p style="margin: 0; color: #666;">Confirmation #${ctx.confirmationNumber}</p>
    ${ctx.specialRequest ? `<p style="margin: 8px 0 0; font-style: italic; color: #666;">Note: ${ctx.specialRequest}</p>` : ''}
  </div>
  ${ctx.manageUrl ? `<p><a href="${ctx.manageUrl}" style="color: #0066cc;">Manage your reservation</a></p>` : ''}
  <p style="color: #999; font-size: 12px;">Powered by FreeRez</p>
</div>`.trim(),
		text: `Reservation Confirmed at ${ctx.restaurantName}\n\n${dateStr} at ${timeStr}\nParty of ${ctx.partySize}\nConfirmation #${ctx.confirmationNumber}\n${ctx.specialRequest ? `Note: ${ctx.specialRequest}\n` : ''}${ctx.manageUrl ? `\nManage: ${ctx.manageUrl}` : ''}`
	};
}

export function reservationCancelledEmail(
	ctx: ReservationContext,
	fromEmail: string
): EmailMessage {
	return {
		to: ctx.guestEmail!,
		from: fromEmail,
		subject: `Reservation Cancelled at ${ctx.restaurantName}`,
		html: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #1a1a1a;">Your reservation has been cancelled</h2>
  <p>Hi ${ctx.guestFirstName},</p>
  <p>Your reservation at <strong>${ctx.restaurantName}</strong> (Confirmation #${ctx.confirmationNumber}) has been cancelled.</p>
  <p>We hope to see you again soon.</p>
  <p style="color: #999; font-size: 12px;">Powered by FreeRez</p>
</div>`.trim(),
		text: `Your reservation at ${ctx.restaurantName} (Confirmation #${ctx.confirmationNumber}) has been cancelled.`
	};
}

export function reservationModifiedEmail(
	ctx: ReservationContext,
	fromEmail: string
): EmailMessage {
	const date = new Date(ctx.dateTime);
	const dateStr = date.toLocaleDateString('en-US', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
	const timeStr = date.toLocaleTimeString('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	});

	return {
		to: ctx.guestEmail!,
		from: fromEmail,
		subject: `Reservation Updated at ${ctx.restaurantName}`,
		html: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #1a1a1a;">Your reservation has been updated</h2>
  <p>Hi ${ctx.guestFirstName},</p>
  <div style="background: #f8f8f8; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0 0 8px;"><strong>${ctx.restaurantName}</strong></p>
    <p style="margin: 0 0 4px;">${dateStr} at ${timeStr}</p>
    <p style="margin: 0 0 4px;">Party of ${ctx.partySize}</p>
    <p style="margin: 0; color: #666;">Confirmation #${ctx.confirmationNumber}</p>
  </div>
  ${ctx.manageUrl ? `<p><a href="${ctx.manageUrl}" style="color: #0066cc;">Manage your reservation</a></p>` : ''}
  <p style="color: #999; font-size: 12px;">Powered by FreeRez</p>
</div>`.trim(),
		text: `Reservation Updated at ${ctx.restaurantName}\n\n${dateStr} at ${timeStr}\nParty of ${ctx.partySize}\nConfirmation #${ctx.confirmationNumber}`
	};
}

export function reservationConfirmedSms(ctx: ReservationContext): SmsMessage {
	const date = new Date(ctx.dateTime);
	const timeStr = date.toLocaleTimeString('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	});
	const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

	return {
		to: ctx.guestPhone!,
		body: `Confirmed: ${ctx.restaurantName}, ${dateStr} at ${timeStr}, party of ${ctx.partySize}. Conf #${ctx.confirmationNumber}${ctx.manageUrl ? `. Manage: ${ctx.manageUrl}` : ''}`
	};
}

export function reservationCancelledSms(ctx: ReservationContext): SmsMessage {
	return {
		to: ctx.guestPhone!,
		body: `Your reservation at ${ctx.restaurantName} (#${ctx.confirmationNumber}) has been cancelled.`
	};
}

export function reservationReminderSms(ctx: ReservationContext): SmsMessage {
	const date = new Date(ctx.dateTime);
	const timeStr = date.toLocaleTimeString('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	});

	return {
		to: ctx.guestPhone!,
		body: `Reminder: ${ctx.restaurantName} today at ${timeStr}, party of ${ctx.partySize}. Conf #${ctx.confirmationNumber}`
	};
}

export function staffInviteEmail(
	ctx: StaffInviteContext,
	fromEmail: string
): EmailMessage {
	return {
		to: ctx.inviteeEmail,
		from: fromEmail,
		subject: `You've been invited to join ${ctx.restaurantName} on FreeRez`,
		html: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #1a1a1a;">You're invited to join ${ctx.restaurantName}</h2>
  <p>Hi ${ctx.inviteeName},</p>
  <p>${ctx.inviterName} has invited you to join <strong>${ctx.restaurantName}</strong> as a <strong>${ctx.role}</strong> on FreeRez.</p>
  <div style="margin: 24px 0;">
    <a href="${ctx.inviteUrl}" style="display: inline-block; padding: 12px 24px; background: #1a1a1a; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 500;">Accept Invitation</a>
  </div>
  <p style="color: #666; font-size: 13px;">This invitation expires in 7 days. If you didn't expect this, you can ignore this email.</p>
  <p style="color: #999; font-size: 12px;">Powered by FreeRez</p>
</div>`.trim(),
		text: `You've been invited to join ${ctx.restaurantName} as a ${ctx.role} by ${ctx.inviterName}.\n\nAccept your invitation: ${ctx.inviteUrl}\n\nThis link expires in 7 days.`
	};
}
