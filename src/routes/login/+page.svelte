<script lang="ts">
	import { goto } from '$app/navigation';

	let mode = $state<'login' | 'register' | 'forgot'>('login');
	let email = $state('');
	let password = $state('');
	let name = $state('');
	let terms = $state(false);
	let loading = $state(false);
	let errorMsg = $state('');
	let resetSent = $state(false);

	async function handleForgot() {
		loading = true;
		errorMsg = '';
		try {
			const res = await fetch('/api/auth/request-password-reset', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, redirectTo: `${window.location.origin}/reset-password` })
			});
			if (res.ok) {
				resetSent = true;
			} else {
				resetSent = true;
			}
		} catch {
			resetSent = true;
		}
		loading = false;
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		loading = true;
		errorMsg = '';

		if (mode === 'forgot') {
			await handleForgot();
			return;
		}

		if (mode === 'login') {
			const res = await fetch('/api/auth/sign-in/email', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			});
			if (res.ok) {
				goto('/dashboard');
			} else {
				const data = (await res.json().catch(() => ({}))) as { message?: string };
				errorMsg = data.message || 'Invalid credentials';
			}
		} else {
			const res = await fetch('/api/auth/sign-up/email', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password, name })
			});
			if (res.ok) {
				goto('/dashboard');
			} else {
				const data = (await res.json().catch(() => ({}))) as { message?: string };
				errorMsg = data.message || 'Registration failed';
			}
		}
		loading = false;
	}
</script>

<svelte:head>
	<title>{mode === 'login' ? 'Sign in' : 'Create account'} — FreeRez</title>
</svelte:head>

<div class="login-shell">
	<!-- Left: form -->
	<div class="login-form-side">
		<div class="login-brand">
			<div class="login-logo">FR</div>
			<span class="login-brand-name">FreeRez</span>
		</div>

		<div class="login-form-wrap">
			<div style="margin-bottom: 32px">
				<h1 style="font-size: 22px; font-weight: 700; letter-spacing: -0.5px; margin: 0">{mode === 'login' ? 'Welcome back' : mode === 'forgot' ? 'Reset password' : 'Create your account'}</h1>
				<p class="fr-subtle" style="margin-top: 6px; font-size: 14px">{mode === 'login' ? 'Sign in to your dashboard.' : mode === 'forgot' ? 'Enter your email and we\'ll send a reset link.' : 'Start managing reservations in minutes.'}</p>
			</div>

			{#if mode === 'forgot' && resetSent}
				<div style="text-align: center; padding: 20px 0">
					<div style="width: 48px; height: 48px; border-radius: 50%; background: #f0fdf4; display: grid; place-items: center; margin: 0 auto 16px">
						<span style="font-size: 20px">&#9993;</span>
					</div>
					<p style="font-size: 14px; font-weight: 500; margin-bottom: 6px">Check your email</p>
					<p class="fr-subtle" style="font-size: 13px">If an account exists for <strong>{email}</strong>, we've sent a password reset link.</p>
					<button class="fr-btn fr-btn-sm" style="margin-top: 20px" onclick={() => { mode = 'login'; resetSent = false; }}>Back to login</button>
				</div>
			{:else}
			<form onsubmit={handleSubmit}>
				{#if mode === 'register'}
					<div style="margin-bottom: 16px">
						<label class="fr-label" for="name">Name</label>
						<input class="fr-input" id="name" type="text" placeholder="Tomas Reyes" bind:value={name} required />
					</div>
				{/if}

				<div style="margin-bottom: 16px">
					<label class="fr-label" for="email">Email</label>
					<input class="fr-input" id="email" type="email" placeholder="you@restaurant.com" bind:value={email} required />
				</div>

				{#if mode !== 'forgot'}
					<div style="margin-bottom: {mode === 'login' ? '8' : '16'}px">
						<div style="display: flex; justify-content: space-between; align-items: baseline">
							<label class="fr-label" for="password">Password</label>
							{#if mode === 'login'}
								<button type="button" tabindex="-1" onclick={() => { mode = 'forgot'; errorMsg = ''; resetSent = false; }} style="font-size: 12px; color: var(--fr-accent); text-decoration: none; background: none; border: none; cursor: pointer; padding: 0">Forgot password?</button>
							{/if}
						</div>
						<input class="fr-input" id="password" type="password" placeholder="••••••••" bind:value={password} required />
					</div>
				{/if}

				{#if mode === 'register'}
					<div style="margin-bottom: 24px">
						<label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer">
							<input type="checkbox" bind:checked={terms} />
							<span>I agree to the <a href="/login" style="color: var(--fr-accent); text-decoration: none">Terms of Service</a></span>
						</label>
					</div>
				{/if}

				<button
					type="submit"
					class="fr-btn fr-btn-primary"
					style="width: 100%; height: 40px; justify-content: center; font-size: 14px; margin-top: {mode === 'login' ? '16' : '0'}px"
					disabled={loading}
				>
					{loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : mode === 'forgot' ? 'Send reset link' : 'Create account'}
				</button>

				{#if errorMsg}
					<p style="color: var(--fr-danger, #e53e3e); font-size: 13px; margin-top: 12px; text-align: center">{errorMsg}</p>
				{/if}
			</form>
			{/if}

			<div style="text-align: center; margin-top: 24px; font-size: 13px">
				{#if mode === 'login'}
					<span class="fr-subtle">Don't have an account?</span>
					<button
						style="background: none; border: none; color: var(--fr-accent); cursor: pointer; font-size: 13px; padding: 0; margin-left: 4px"
						onclick={() => mode = 'register'}
					>
						Create one
					</button>
				{:else if mode === 'forgot'}
					<button
						style="background: none; border: none; color: var(--fr-accent); cursor: pointer; font-size: 13px; padding: 0"
						onclick={() => { mode = 'login'; resetSent = false; }}
					>
						Back to sign in
					</button>
				{:else}
					<span class="fr-subtle">Already have an account?</span>
					<button
						style="background: none; border: none; color: var(--fr-accent); cursor: pointer; font-size: 13px; padding: 0; margin-left: 4px"
						onclick={() => mode = 'login'}
					>
						Sign in
					</button>
				{/if}
			</div>
		</div>

		<div class="login-foot">
			<span class="fr-subtle" style="font-size: 11.5px">MIT License &middot; FreeRez is open-source software</span>
		</div>
	</div>

	<!-- Right: brand panel -->
	<div class="login-brand-side">
		<div class="login-brand-content">
			<div class="fr-mono" style="font-size: 12px; letter-spacing: 0.5px; text-transform: uppercase; opacity: 0.6; margin-bottom: 16px">No cover fees, ever</div>
			<h2 style="font-size: 36px; font-weight: 700; line-height: 1.15; letter-spacing: -1px; margin: 0">The reservation platform restaurants own.</h2>
			<p style="margin-top: 16px; font-size: 15px; line-height: 1.7; opacity: 0.7">
				Open-source, self-hostable, and API-first. Replace per-cover fees with software you control.
			</p>
		</div>
	</div>
</div>

<style>
	.login-shell {
		display: grid;
		grid-template-columns: 1fr 1fr;
		min-height: 100vh;
		min-height: 100dvh;
	}

	.login-form-side {
		display: flex;
		flex-direction: column;
		padding: 32px 40px;
	}

	.login-brand {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.login-logo {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		background: var(--fr-accent);
		color: white;
		display: grid;
		place-items: center;
		font-size: 13px;
		font-weight: 700;
		letter-spacing: -0.5px;
	}

	.login-brand-name {
		font-size: 16px;
		font-weight: 700;
		letter-spacing: -0.5px;
	}

	.login-form-wrap {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		max-width: 380px;
		margin: 0 auto;
		width: 100%;
	}

	.login-foot {
		text-align: center;
		padding-top: 16px;
	}

	.login-brand-side {
		background: var(--fr-surface-muted);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 60px;
		background-image: repeating-linear-gradient(
			45deg,
			transparent,
			transparent 28px,
			color-mix(in oklch, var(--fr-text) 4%, transparent) 28px,
			color-mix(in oklch, var(--fr-text) 4%, transparent) 29px
		);
	}

	.login-brand-content {
		max-width: 420px;
	}
</style>
