<script lang="ts">
	import { page } from '$app/state';

	let token = $derived(page.url.searchParams.get('token') ?? '');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let submitting = $state(false);
	let error = $state<string | null>(null);
	let success = $state(false);

	async function handleReset() {
		error = null;
		if (newPassword.length < 8) { error = 'Password must be at least 8 characters'; return; }
		if (newPassword !== confirmPassword) { error = 'Passwords do not match'; return; }
		if (!token) { error = 'Invalid reset link — no token found'; return; }

		submitting = true;
		try {
			const resp = await fetch('/api/auth/reset-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ newPassword, token })
			});
			const data = await resp.json() as Record<string, unknown>;
			const errObj = data.error as Record<string, unknown> | undefined;
			if (!resp.ok || errObj) {
				error = (errObj?.message as string) ?? (data.message as string) ?? 'Password reset failed. The link may have expired.';
			} else {
				success = true;
			}
		} catch {
			error = 'Something went wrong. Please try again.';
		}
		submitting = false;
	}
</script>

<div style="min-height: 100vh; display: grid; place-items: center; background: var(--fr-bg, #fafafa); padding: 20px">
	<div style="width: 100%; max-width: 420px">
		<div style="text-align: center; margin-bottom: 32px">
			<div style="font-size: 28px; font-weight: 700; letter-spacing: -1px">FreeRez</div>
		</div>

		<div style="background: #fff; border: 1px solid #e5e5e5; border-radius: 12px; padding: 32px">
			{#if success}
				<h2 style="font-size: 18px; font-weight: 600; margin-bottom: 8px">Password reset</h2>
				<p style="color: #666; font-size: 14px; margin-bottom: 20px">Your password has been updated. You can now log in with your new password.</p>
				<a href="/login" style="display: inline-block; padding: 10px 20px; background: #1a1a1a; color: #fff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500">Go to login</a>
			{:else if !token}
				<h2 style="font-size: 18px; font-weight: 600; margin-bottom: 8px">Invalid link</h2>
				<p style="color: #666; font-size: 14px">This password reset link is invalid or has expired. Please request a new one.</p>
				<a href="/login" style="display: inline-block; margin-top: 16px; color: #0066cc; font-size: 14px">Back to login</a>
			{:else}
				<h2 style="font-size: 18px; font-weight: 600; margin-bottom: 4px">Set new password</h2>
				<p style="color: #666; font-size: 13px; margin-bottom: 24px">Enter your new password below.</p>

				{#if error}
					<div style="padding: 10px 14px; margin-bottom: 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; color: #991b1b; font-size: 13px">{error}</div>
				{/if}

				<form onsubmit={(e) => { e.preventDefault(); handleReset(); }}>
					<div style="margin-bottom: 16px">
						<label for="new-pw" style="display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px">New password</label>
						<input id="new-pw" type="password" required minlength="8" bind:value={newPassword}
							style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box" />
					</div>
					<div style="margin-bottom: 24px">
						<label for="confirm-pw" style="display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px">Confirm password</label>
						<input id="confirm-pw" type="password" required minlength="8" bind:value={confirmPassword}
							style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box" />
						<p style="margin-top: 4px; font-size: 12px; color: #999">At least 8 characters</p>
					</div>
					<button type="submit" disabled={submitting || newPassword.length < 8}
						style="width: 100%; padding: 12px; background: #1a1a1a; color: #fff; border: none; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer">
						{submitting ? 'Resetting...' : 'Reset password'}
					</button>
				</form>
			{/if}
		</div>
	</div>
</div>
