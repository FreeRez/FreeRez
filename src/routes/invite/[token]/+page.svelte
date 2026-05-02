<script lang="ts">
	let { data, form } = $props();
	let name = $state(data.name ?? '');
	let password = $state('');
	let submitting = $state(false);
</script>

<div style="min-height: 100vh; display: grid; place-items: center; background: var(--fr-bg, #fafafa); padding: 20px">
	<div style="width: 100%; max-width: 420px">
		<div style="text-align: center; margin-bottom: 32px">
			<div style="font-size: 28px; font-weight: 700; letter-spacing: -1px">FreeRez</div>
		</div>

		{#if !data.valid}
			<div style="background: #fff; border: 1px solid #e5e5e5; border-radius: 12px; padding: 40px 32px; text-align: center">
				{#if data.error === 'not_found'}
					<h2 style="font-size: 18px; font-weight: 600; margin-bottom: 8px">Invalid Invite</h2>
					<p style="color: #666; font-size: 14px">This invite link is not valid. Please ask your team admin for a new invitation.</p>
				{:else if data.error === 'expired'}
					<h2 style="font-size: 18px; font-weight: 600; margin-bottom: 8px">Invite Expired</h2>
					<p style="color: #666; font-size: 14px">This invite has expired. Please ask your team admin to send a new one.</p>
				{:else if data.error === 'already_accepted'}
					<h2 style="font-size: 18px; font-weight: 600; margin-bottom: 8px">Already Accepted</h2>
					<p style="color: #666; font-size: 14px">This invitation has already been accepted.</p>
					<a href="/login" style="display: inline-block; margin-top: 16px; color: #0066cc; font-size: 14px">Go to login</a>
				{:else}
					<h2 style="font-size: 18px; font-weight: 600; margin-bottom: 8px">Something went wrong</h2>
					<p style="color: #666; font-size: 14px">Please try again later.</p>
				{/if}
			</div>
		{:else}
			<div style="background: #fff; border: 1px solid #e5e5e5; border-radius: 12px; padding: 32px">
				<h2 style="font-size: 18px; font-weight: 600; margin-bottom: 4px">Join {data.restaurantName}</h2>
				<p style="color: #666; font-size: 13px; margin-bottom: 24px">You've been invited as <strong>{data.role}</strong>. Set up your account to get started.</p>

				{#if form?.error}
					<div style="padding: 10px 14px; margin-bottom: 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; color: #991b1b; font-size: 13px">{form.error}</div>
				{/if}

				<form method="POST" onsubmit={() => submitting = true}>
					<div style="margin-bottom: 16px">
						<label for="name" style="display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px">Full name</label>
						<input id="name" name="name" type="text" required bind:value={name}
							style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box" />
					</div>
					<div style="margin-bottom: 16px">
						<label for="email" style="display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px">Email</label>
						<input id="email" type="email" disabled value={data.email}
							style="width: 100%; padding: 10px 12px; border: 1px solid #e5e5e5; border-radius: 6px; font-size: 14px; background: #f9f9f9; color: #666; box-sizing: border-box" />
					</div>
					<div style="margin-bottom: 24px">
						<label for="password" style="display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px">Create password</label>
						<input id="password" name="password" type="password" required minlength="8" bind:value={password}
							style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box" />
						<p style="margin-top: 4px; font-size: 12px; color: #999">At least 8 characters</p>
					</div>
					<button type="submit" disabled={submitting || !name || password.length < 8}
						style="width: 100%; padding: 12px; background: #1a1a1a; color: #fff; border: none; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer">
						{submitting ? 'Setting up...' : 'Accept & create account'}
					</button>
				</form>
			</div>
		{/if}
	</div>
</div>
