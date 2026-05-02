import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { Database } from '$db';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

const user = sqliteTable('users', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: integer('email_verified', { mode: 'boolean' }).default(false),
	image: text('image'),
	role: text('role').default('staff'),
	createdAt: integer('created_at', { mode: 'timestamp' }),
	updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

const session = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull(),
	token: text('token').notNull().unique(),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	createdAt: integer('created_at', { mode: 'timestamp' }),
	updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

const account = sqliteTable('accounts', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull(),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
	refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
	scope: text('scope'),
	idToken: text('id_token'),
	password: text('password'),
	createdAt: integer('created_at', { mode: 'timestamp' }),
	updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

const verification = sqliteTable('verifications', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }),
	updatedAt: integer('updated_at', { mode: 'timestamp' }),
});
import type { EmailAdapter } from '$lib/server/notifications/types';

export type SessionUser = {
	id: string;
	name: string;
	email: string;
	role: string;
	image?: string | null;
};

export type Session = {
	id: string;
	userId: string;
	token: string;
	expiresAt: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createAuth(
	db: Database,
	options: {
		baseURL?: string;
		secret?: string;
		emailAdapter?: EmailAdapter | null;
	} = {}
) {
	return betterAuth({
		baseURL: options.baseURL ?? 'http://localhost:5173',
		secret: options.secret,
		database: drizzleAdapter(db as any, { provider: 'sqlite', schema: { user, session, account, verification } }),
		emailAndPassword: {
			enabled: true,
			...(options.emailAdapter
				? {
						sendResetPassword: async ({
							user,
							url
						}: {
							user: { email: string; name: string };
							url: string;
						}) => {
							void options.emailAdapter!.send({
								to: user.email,
								from: 'noreply@freerez.com',
								subject: 'Reset your FreeRez password',
								html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;"><h2>Reset your password</h2><p>Hi ${user.name},</p><p>Click below to set a new password.</p><div style="margin: 24px 0;"><a href="${url}" style="display: inline-block; padding: 12px 24px; background: #1a1a1a; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 500;">Reset Password</a></div><p style="color: #666; font-size: 13px;">This link expires in 1 hour.</p><p style="color: #999; font-size: 12px;">Powered by FreeRez</p></div>`,
								text: `Reset your FreeRez password: ${url}\n\nThis link expires in 1 hour.`
							});
						}
					}
				: {})
		},
		session: {
			expiresIn: 60 * 60 * 24 * 7,
			updateAge: 60 * 60 * 24
		}
	});
}
