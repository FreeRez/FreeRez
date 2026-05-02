export type EmailMessage = {
	to: string;
	subject: string;
	html: string;
	text: string;
	from?: string;
	replyTo?: string;
};

export type SmsMessage = {
	to: string;
	body: string;
	from?: string;
};

export type NotificationEvent =
	| 'reservation.confirmed'
	| 'reservation.reminder'
	| 'reservation.cancelled'
	| 'reservation.modified'
	| 'reservation.noshow'
	| 'guest.welcome'
	| 'staff.invited';

export type StaffInviteContext = {
	restaurantName: string;
	inviteeEmail: string;
	inviteeName: string;
	inviterName: string;
	role: string;
	inviteUrl: string;
};

export type ReservationContext = {
	restaurantName: string;
	guestFirstName: string;
	guestLastName: string;
	guestEmail?: string | null;
	guestPhone?: string | null;
	dateTime: string;
	partySize: number;
	confirmationNumber: number;
	specialRequest?: string | null;
	manageUrl?: string | null;
};

export interface EmailAdapter {
	send(message: EmailMessage): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

export interface SmsAdapter {
	send(message: SmsMessage): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

export interface NotificationService {
	email: EmailAdapter | null;
	sms: SmsAdapter | null;
}
