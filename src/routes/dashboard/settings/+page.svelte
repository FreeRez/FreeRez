<script lang="ts">
	import { Save, SquarePen, Trash2, Plus, Upload, UserPlus, Image } from 'lucide-svelte';
	import { invalidateAll } from '$app/navigation';
	import { onMount, untrack } from 'svelte';
	import SpaceEditor from '$lib/components/dashboard/SpaceEditor.svelte';
	import { floorPlanData, type Floor, type FloorTable } from '$lib/stores/floorplan-data';

	let activeTab = $state('profile');
	let integrationError = $state<string | null>(null);
	let integrationSuccess = $state<string | null>(null);

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		if (params.has('error') || params.has('connected')) {
			activeTab = 'integrations';
			if (params.get('error') === 'not_configured') {
				const provider = params.get('provider') ?? 'this integration';
				integrationError = `${provider === 'google-my-business' ? 'Google Business Profile' : provider} is not yet available on this instance. Please contact your administrator to configure this integration.`;
			} else if (params.get('error') === 'oauth_denied') {
				integrationError = 'OAuth authorization was denied. Please try again.';
			} else if (params.get('error') === 'oauth_failed') {
				integrationError = 'OAuth token exchange failed. Please try again.';
			} else if (params.has('connected')) {
				integrationSuccess = 'Integration connected successfully.';
			}
			window.history.replaceState({}, '', window.location.pathname);
		}
	});
	let showInvite = $state(false);
	let inviteEmail = $state('');
	let inviteRole = $state('server');
	let inviteError = $state<string | null>(null);
	let inviteSending = $state(false);
	let inviteSuccess = $state<string | null>(null);
	let photoPreview = $state<string | null>(null);
	let editingPolicyIdx = $state<number | null>(null);
	let editPolicyType = $state('');
	let editPolicyBody = $state('');
	let showAddPolicy = $state(false);
	let newPolicyType = $state('General');
	let newPolicyMessage = $state('');
	let showAddRoom = $state(false);
	let newRoomName = $state('');
	let newRoomDesc = $state('');
	let newRoomCapacity = $state('12');

	const tabs = [
		{ id: 'profile', label: 'Profile' },
		{ id: 'policies', label: 'Policies' },
		{ id: 'staff', label: 'Staff' },
		{ id: 'integrations', label: 'Integrations' },
		{ id: 'floorplan', label: 'Floor plan' },
		{ id: 'private', label: 'Private dining' }
	];

	let { data } = $props();

	const savedFloors = untrack(() => data.savedLayout?.floors as Floor[] | undefined);
	const savedTables = untrack(() => data.savedLayout?.tables as FloorTable[] | undefined);
	let currentFloors = $state<Floor[]>(savedFloors?.length ? structuredClone(savedFloors) : structuredClone(floorPlanData.floors));
	let currentTables = $state<FloorTable[]>(savedTables?.length ? structuredClone(savedTables) : structuredClone(floorPlanData.tables));

	const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

	const hours = $derived(DAYS.map(day => {
		const slots = (data.restaurant?.openingTimes as Record<string, Array<{ start: string; end: string }>> | null)?.[day] ?? [];
		return {
			day,
			open: slots[0]?.start ?? 'Closed',
			close: slots[0]?.end ?? '',
		};
	}));

	const policies = $derived(
		(data.bookingPolicies ?? []).map((p: { id: string; policyType: string; message: string }) => ({
			id: p.id,
			type: p.policyType ?? 'General',
			title: `${p.policyType ?? 'General'} policy`,
			body: p.message ?? '',
		}))
	);

	const staff = $derived(
		(data.staff ?? []).map((s: { id: string; userId: string; userName: string | null; userEmail: string | null; role: string; active: boolean | null }) => ({
			id: s.id,
			userId: s.userId,
			name: s.userName ?? 'Unknown',
			initials: (s.userName ?? 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
			email: s.userEmail ?? '',
			role: s.role ? s.role.charAt(0).toUpperCase() + s.role.slice(1) : 'Staff',
			status: s.active ? 'active' : 'invited',
		}))
	);

	let editingMemberId = $state<string | null>(null);
	let editName = $state('');
	let editEmail = $state('');
	let editSaving = $state(false);

	const integrationCatalog = [
		{ id: 'toast-pos', name: 'Toast POS', desc: 'Sync covers, spend, and ticket data in real-time.' },
		{ id: 'resend', name: 'Resend', desc: 'Transactional emails — confirmations, reminders, follow-ups.' },
		{ id: 'twilio', name: 'Twilio', desc: 'SMS confirmations and waitlist alerts.' },
		{ id: 'stripe', name: 'Stripe', desc: 'Prepaid experience payments and no-show charges.' },
		{ id: 'google-my-business', name: 'Google Business Profile', desc: 'Sync reviews and business hours with your Google listing.', oauthProvider: true },
		{ id: 'opentable-mirror', name: 'OpenTable Mirror', desc: 'Bi-directional sync with your existing OpenTable account.' }
	];

	const connectedIntegrations = $derived(
		new Set((data.integrations ?? []).filter((i: { status: string }) => i.status === 'active').map((i: { partnerId: string }) => i.partnerId))
	);

	const gmbIntegration = $derived(
		(data.integrations ?? []).find((i: { partnerId: string }) => i.partnerId === 'google-my-business')
	);

	const gmbHasCredentials = $derived(
		data.gmbConfigured || !!(gmbIntegration?.metadata as Record<string, unknown> | undefined)?.oauthClientId
	);

	let gmbSyncing = $state(false);
	let showGmbSetup = $state(false);
	let gmbClientId = $state('');
	let gmbClientSecret = $state('');
	let gmbSaving = $state(false);

	let priceBand = $state(untrack(() => data.restaurant?.priceBandId ?? 2));
	const priceBands = ['$', '$$', '$$$', '$$$$'];

	const tagsList = $derived((data.restaurant?.tags as string[] | null) ?? []);
</script>

{#if activeTab === 'floorplan'}
<div style="display: flex; flex-direction: column; flex: 1; overflow: hidden">
	<div style="padding: 1rem 1.5rem 0; flex-shrink: 0">
		<div class="fr-tabs" style="margin-bottom: 0">
			{#each tabs as tab (tab.id)}
				<button
					class="fr-tab"
					class:active={activeTab === tab.id}
					onclick={() => activeTab = tab.id}
				>
					{tab.label}
				</button>
			{/each}
		</div>
	</div>
	<div style="flex: 1; display: flex; flex-direction: column; position: relative; overflow: hidden">
		<SpaceEditor
			floors={currentFloors}
			tables={currentTables}
			onsave={async (floors, tables) => {
				const fd = new FormData();
				fd.set('layout', JSON.stringify({ floors, tables: tables.map(t => ({ id: t.id, area: t.area, floorId: t.floorId, shape: t.shape, x: t.x, y: t.y, d: t.d, w: t.w, h: t.h, rot: t.rot, seats: t.seats, status: t.status })) }));
				await fetch('/dashboard/floor?/saveLayout', { method: 'POST', body: fd });
				const { invalidateAll } = await import('$app/navigation');
				await invalidateAll();
			}}
		/>
	</div>
</div>
{:else}
<div class="fr-content">
	<div class="fr-page-head">
		<div>
			<h1 class="fr-page-title">Settings</h1>
			<p class="fr-page-sub">{data.restaurant?.name ?? 'Restaurant'} · Restaurant ID <span class="fr-mono">{data.restaurant?.rid ?? ''}</span></p>
		</div>
		<div class="fr-row" style="gap: 8px">
			<button class="fr-btn fr-btn-primary" onclick={async (e) => {
			const btn = e.currentTarget as HTMLButtonElement;
			btn.disabled = true;
			btn.textContent = 'Saving...';
			const fd = new FormData();
			const val = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)?.value ?? '';
			fd.set('name', val('s-name'));
			fd.set('description', val('s-desc'));
			fd.set('cuisine', val('s-cuisine'));
			fd.set('phone', val('s-phone'));
			fd.set('website', val('s-web'));
			fd.set('diningStyle', val('s-style'));
			fd.set('dressCode', val('s-dress'));
			fd.set('address', val('s-addr'));
			fd.set('timezone', val('s-tz'));
			fd.set('priceBandId', String(priceBand));
			await fetch('/dashboard/settings?/updateProfile', { method: 'POST', body: fd });
			const { invalidateAll } = await import('$app/navigation');
			await invalidateAll();
			btn.textContent = '✓ Saved';
			btn.disabled = false;
			setTimeout(() => { btn.innerHTML = ''; btn.textContent = 'Save changes'; }, 2000);
		}}><Save size={14} /> Save changes</button>
		</div>
	</div>

	<div class="fr-tabs" style="margin-bottom: 1.5rem">
		{#each tabs as tab (tab.id)}
			<button
				class="fr-tab"
				class:active={activeTab === tab.id}
				onclick={() => activeTab = tab.id}
			>
				{tab.label}
			</button>
		{/each}
	</div>

	<!-- Profile tab -->
	{#if activeTab === 'profile'}
		<div style="display: grid; grid-template-columns: 1fr 320px; gap: 18px; align-items: start">
			<div class="fr-card fr-card-pad">
				<div class="fr-card-title" style="margin-bottom: 20px">Restaurant profile</div>
				<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px">
					<div>
						<label class="fr-label" for="s-name">Name</label>
						<input class="fr-input" id="s-name" type="text" value={data.restaurant?.name ?? ''} />
					</div>
					<div>
						<label class="fr-label" for="s-cuisine">Cuisine</label>
						<input class="fr-input" id="s-cuisine" type="text" value={data.restaurant?.primaryCuisine ?? ''} />
					</div>
					<div>
						<label class="fr-label" for="s-style">Dining style</label>
						<select class="fr-select" id="s-style" value={data.restaurant?.diningStyle ?? ''}>
							<option>Fine Dining</option>
							<option>Casual Dining</option>
							<option>Casual Elegant</option>
							<option>Contemporary</option>
							<option>Bistro</option>
						</select>
					</div>
					<div>
						<label class="fr-label" for="s-dress">Dress code</label>
						<select class="fr-select" id="s-dress" value={data.restaurant?.dressCode ?? ''}>
							<option>Smart Casual</option>
							<option>Casual</option>
							<option>Business Casual</option>
							<option>Formal</option>
						</select>
					</div>
					<div style="grid-column: 1 / -1">
						<label class="fr-label" for="s-desc">Description</label>
						<textarea class="fr-textarea" id="s-desc" rows="3">{data.restaurant?.description ?? ''}</textarea>
					</div>
					<div>
						<label class="fr-label" for="s-phone">Phone</label>
						<input class="fr-input" id="s-phone" type="tel" value={data.restaurant?.phone ?? ''} />
					</div>
					<div>
						<label class="fr-label" for="s-web">Website</label>
						<input class="fr-input" id="s-web" type="url" value={data.restaurant?.website ?? ''} />
					</div>
					<div style="grid-column: 1 / -1">
						<label class="fr-label" for="s-addr">Address</label>
						<input class="fr-input" id="s-addr" type="text" value={[data.restaurant?.address, data.restaurant?.city, data.restaurant?.state, data.restaurant?.postalCode].filter(Boolean).join(', ')} />
					</div>
					<div>
						<label class="fr-label" for="s-tz">Timezone</label>
						<select class="fr-select" id="s-tz" value={data.restaurant?.timezone ?? 'America/Los_Angeles'}>
							<option>America/Los_Angeles</option>
							<option>America/New_York</option>
							<option>America/Chicago</option>
							<option>America/Denver</option>
							<option>America/Phoenix</option>
							<option>Europe/London</option>
							<option>Europe/Paris</option>
							<option>Asia/Tokyo</option>
							<option>Australia/Sydney</option>
						</select>
					</div>
					<div>
						<label class="fr-label" for="s-price">Price band</label>
						<div class="fr-segment" id="s-price">
							{#each priceBands as band, i (band)}
								<button
									class="fr-segment-btn"
									class:active={priceBand === i + 1}
									onclick={() => priceBand = i + 1}
								>
									{band}
								</button>
							{/each}
						</div>
					</div>
					<div style="grid-column: 1 / -1">
						<label class="fr-label" for="s-tags">Tags</label>
						<div style="display: flex; gap: 6px; flex-wrap: wrap" id="s-tags">
							{#each tagsList as tag (tag)}
								<span class="fr-tag">{tag}</span>
							{/each}
						</div>
					</div>
				</div>
			</div>

			<div style="display: flex; flex-direction: column; gap: 18px">
				<div class="fr-card fr-card-pad">
					<div class="fr-card-title" style="margin-bottom: 12px">Profile photo</div>
					{#if photoPreview}
						<img src={photoPreview} alt="Profile" style="width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: var(--fr-radius-sm); margin-bottom: 12px" />
					{:else}
						<div style="aspect-ratio: 4/3; background: var(--fr-surface-muted); border-radius: 8px; border: 1px solid var(--fr-border); display: grid; place-items: center; margin-bottom: 12px">
							<Image size={32} color="var(--fr-text-muted)" />
						</div>
					{/if}
					<label class="fr-btn fr-btn-sm" style="width: 100%; cursor: pointer; justify-content: center">
						<Upload size={13} /> Replace photo
						<input type="file" accept="image/*" style="display: none" onchange={(e) => {
							const file = (e.target as HTMLInputElement).files?.[0];
							if (file) {
								const reader = new FileReader();
								reader.onload = () => { photoPreview = reader.result as string; };
								reader.readAsDataURL(file);
							}
						}} />
					</label>
				</div>

				<div class="fr-card fr-card-pad">
					<div class="fr-card-title" style="margin-bottom: 12px">Opening hours</div>
					<div style="display: flex; flex-direction: column; gap: 8px">
						{#each hours as h (h.day)}
							<div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px">
								<span style="width: 80px; font-weight: 500">{h.day.slice(0, 3)}</span>
								<span class="fr-num fr-subtle">{h.close ? `${h.open} – ${h.close}` : h.open}</span>
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Policies tab -->
	{#if activeTab === 'policies'}
		<div class="fr-card">
			<div class="fr-card-head">
				<div class="fr-card-title">Booking policies</div>
				<button class="fr-btn fr-btn-sm" onclick={() => { showAddPolicy = true; newPolicyType = 'General'; newPolicyMessage = ''; }}><Plus size={13} /> Add policy</button>
			</div>
			{#if showAddPolicy}
				<div style="padding: 16px 20px; border-bottom: 1px solid var(--fr-border); display: flex; flex-direction: column; gap: 10px">
					<div style="display: flex; gap: 8px">
						<div style="width: 160px">
							<label class="fr-label" for="new-policy-type">Type</label>
							<select class="fr-select" id="new-policy-type" bind:value={newPolicyType}>
								<option>General</option>
								<option>Cancellation</option>
								<option>Group</option>
								<option>Custom</option>
							</select>
						</div>
						<div style="flex: 1">
							<label class="fr-label" for="new-policy-msg">Policy text</label>
							<textarea class="fr-textarea" id="new-policy-msg" rows="2" bind:value={newPolicyMessage} placeholder="Describe the policy..."></textarea>
						</div>
					</div>
					<div style="display: flex; justify-content: flex-end; gap: 8px">
						<button class="fr-btn fr-btn-sm" onclick={() => showAddPolicy = false}>Cancel</button>
						<button class="fr-btn fr-btn-sm fr-btn-primary" disabled={!newPolicyMessage.trim()} onclick={async () => {
							const fd = new FormData();
							fd.set('type', newPolicyType);
							fd.set('message', newPolicyMessage);
							await fetch('/dashboard/settings?/createPolicy', { method: 'POST', body: fd });
							await invalidateAll();
							showAddPolicy = false;
						}}><Plus size={13} /> Create</button>
					</div>
				</div>
			{/if}
			{#if policies.length === 0 && !showAddPolicy}
				<div style="padding: 48px 20px; text-align: center">
					<p class="fr-subtle" style="font-size: 13px">No booking policies configured yet. Add your first policy to inform guests about cancellations, deposits, or group dining rules.</p>
				</div>
			{/if}
			{#each policies as policy, i (policy.id)}
				<div style="padding: 20px; border-top: 1px solid var(--fr-border)">
					{#if editingPolicyIdx === i}
						<div style="display: flex; flex-direction: column; gap: 12px">
							<div>
								<label class="fr-label" for="edit-policy-body">Policy text</label>
								<textarea class="fr-textarea" id="edit-policy-body" rows="3" bind:value={editPolicyBody}></textarea>
							</div>
							<div style="display: flex; justify-content: flex-end; gap: 8px">
								<button class="fr-btn fr-btn-sm" onclick={() => editingPolicyIdx = null}>Cancel</button>
								<button class="fr-btn fr-btn-sm fr-btn-primary" onclick={async () => {
									const fd = new FormData();
									fd.set('policyId', policy.id);
									fd.set('message', editPolicyBody);
									await fetch('/dashboard/settings?/updatePolicy', { method: 'POST', body: fd });
									await invalidateAll();
									editingPolicyIdx = null;
								}}><Save size={13} /> Save</button>
							</div>
						</div>
					{:else}
						<div style="display: flex; align-items: flex-start; gap: 12px">
							<div style="flex: 1; min-width: 0">
								<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px">
									<span class="fr-tag">{policy.type}</span>
								</div>
								<div style="font-size: 13px; line-height: 1.6; color: var(--fr-text-muted)">{policy.body}</div>
							</div>
							<div class="fr-row" style="gap: 4px; flex-shrink: 0">
								<button class="fr-btn fr-btn-sm fr-btn-ghost" onclick={() => {
									editingPolicyIdx = i;
									editPolicyType = policy.type;
									editPolicyBody = policy.body;
								}}><SquarePen size={13} /></button>
								<button class="fr-btn fr-btn-sm fr-btn-ghost" onclick={async () => {
									const fd = new FormData();
									fd.set('policyId', policy.id);
									await fetch('/dashboard/settings?/deletePolicy', { method: 'POST', body: fd });
									await invalidateAll();
								}}><Trash2 size={13} /></button>
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Staff tab -->
	{#if activeTab === 'staff'}
		<div class="fr-card">
			<div class="fr-card-head">
				<div class="fr-card-title">Team</div>
				<button class="fr-btn fr-btn-sm" onclick={() => showInvite = !showInvite}><UserPlus size={13} /> Invite member</button>
			</div>
			{#if showInvite}
				<div style="padding: 16px 20px; border-bottom: 1px solid var(--fr-border)">
					{#if inviteError}
						<div style="padding: 8px 12px; margin-bottom: 10px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; color: #991b1b; font-size: 12px">{inviteError}</div>
					{/if}
					<div style="display: flex; gap: 8px; align-items: flex-end">
						<div style="flex: 1">
							<label class="fr-label" for="invite-email">Email</label>
							<input class="fr-input" id="invite-email" type="email" bind:value={inviteEmail} placeholder="colleague@restaurant.com" />
						</div>
						<div style="width: 140px">
							<label class="fr-label" for="invite-role">Role</label>
							<select class="fr-select" id="invite-role" bind:value={inviteRole}>
								<option value="server">Server</option>
								<option value="host">Host</option>
								<option value="manager">Manager</option>
								<option value="owner">Owner</option>
							</select>
						</div>
						<button class="fr-btn fr-btn-primary fr-btn-sm" disabled={inviteSending || !inviteEmail} onclick={async () => {
							inviteError = null;
							inviteSending = true;
							const fd = new FormData();
							fd.set('email', inviteEmail);
							fd.set('role', inviteRole);
							const resp = await fetch('/dashboard/settings?/inviteMember', { method: 'POST', body: fd });
							const text = await resp.text();
							const hasError = text.includes('"success":false') || text.includes('"success":0');
							const errorMatch = text.match(/"error":"([^"]+)"/);
							const urlMatch = text.match(/"inviteUrl":"([^"]+)"/);
							if (hasError) {
								inviteError = errorMatch?.[1] ?? 'Failed to send invite';
							} else {
								inviteEmail = '';
								inviteRole = 'server';
								showInvite = false;
								if (urlMatch?.[1]) {
									inviteSuccess = urlMatch[1];
								}
							}
							await invalidateAll();
							inviteSending = false;
						}}>{inviteSending ? 'Sending...' : 'Send invite'}</button>
						<button class="fr-btn fr-btn-sm" onclick={() => { showInvite = false; inviteEmail = ''; inviteError = null; }}>Cancel</button>
					</div>
				</div>
			{/if}

			{#if inviteSuccess}
				<div style="padding: 12px 16px; margin: 0; border-bottom: 1px solid var(--fr-border); background: #f0fdf4; color: #166534; font-size: 13px; display: flex; align-items: center; gap: 10px">
					<span style="flex: 1">Invite sent! Share this link if the email doesn't arrive: <a href={inviteSuccess} style="color: #166534; word-break: break-all">{inviteSuccess}</a></span>
					<button style="background: none; border: none; cursor: pointer; color: #166534; font-size: 16px; padding: 0 4px" onclick={() => inviteSuccess = null}>&times;</button>
				</div>
			{/if}

			{#if staff.length === 0}
				<div style="padding: 48px 20px; text-align: center">
					<p class="fr-subtle" style="font-size: 13px">No team members yet. Invite your first staff member to get started.</p>
				</div>
			{:else}
				<table class="fr-table">
					<thead>
						<tr>
							<th>Name</th>
							<th>Email</th>
							<th style="width: 140px">Role</th>
							<th style="width: 100px">Status</th>
							<th style="width: 40px"></th>
						</tr>
					</thead>
					<tbody>
						{#each staff as member (member.id)}
							<tr style="cursor: pointer" onclick={() => {
								if (editingMemberId === member.id) return;
								editingMemberId = member.id;
								editName = member.name;
								editEmail = member.email;
							}}>
								<td>
									<div style="display: flex; align-items: center; gap: 10px">
										<div class="fr-avatar">{member.initials}</div>
										<span style="font-weight: 500">{member.name}</span>
									</div>
								</td>
								<td>
									<span class="fr-subtle" style="font-size: 13px">{member.email}</span>
								</td>
								<td>
									{#if member.role === 'Owner'}
										<span style="font-size: 13px; font-weight: 500">{member.role}</span>
									{:else}
										<!-- svelte-ignore a11y_click_events_have_key_events -->
										<!-- svelte-ignore a11y_no_static_element_interactions -->
										<div onclick={(e) => e.stopPropagation()}>
											<select class="fr-select" style="font-size: 12px; padding: 4px 8px; height: auto" value={member.role.toLowerCase()} onchange={async (e) => {
												const fd = new FormData();
												fd.set('staffId', member.id);
												fd.set('role', (e.target as HTMLSelectElement).value);
												await fetch('/dashboard/settings?/updateStaffRole', { method: 'POST', body: fd });
												await invalidateAll();
											}}>
												<option value="server">Server</option>
												<option value="host">Host</option>
												<option value="manager">Manager</option>
												<option value="owner">Owner</option>
											</select>
										</div>
									{/if}
								</td>
								<td>
									<span class="fr-badge {member.status === 'active' ? 'confirmed' : 'cancelled'}">{member.status === 'active' ? 'Active' : 'Invited'}</span>
								</td>
								<td style="text-align: right">
									<!-- svelte-ignore a11y_click_events_have_key_events -->
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<div onclick={(e) => e.stopPropagation()} style="display: flex; gap: 2px; justify-content: flex-end">
										{#if member.userId !== data.user?.id}
											<button class="fr-btn fr-btn-icon fr-btn-ghost" style="color: var(--fr-danger)" onclick={async () => {
												if (!confirm(`Remove ${member.name} from the team?`)) return;
												const fd = new FormData();
												fd.set('staffId', member.id);
												await fetch('/dashboard/settings?/removeMember', { method: 'POST', body: fd });
												editingMemberId = null;
												await invalidateAll();
											}}><Trash2 size={14} /></button>
										{/if}
									</div>
								</td>
							</tr>
							{#if editingMemberId === member.id}
								<tr>
									<td colspan="5" style="padding: 16px 20px; background: var(--fr-surface-muted); border-top: none">
										<div style="display: flex; gap: 12px; align-items: end">
											<div style="flex: 1">
												<label class="fr-label" for="edit-name-{member.id}">Name</label>
												<input class="fr-input" id="edit-name-{member.id}" type="text" bind:value={editName} />
											</div>
											<div style="flex: 1">
												<label class="fr-label" for="edit-email-{member.id}">Email</label>
												<input class="fr-input" id="edit-email-{member.id}" type="email" bind:value={editEmail} />
											</div>
											<div style="display: flex; gap: 8px; padding-bottom: 1px">
											<button class="fr-btn fr-btn-sm fr-btn-primary" disabled={editSaving} onclick={async () => {
												editSaving = true;
												const fd = new FormData();
												fd.set('staffId', member.id);
												fd.set('name', editName);
												fd.set('email', editEmail);
												await fetch('/dashboard/settings?/updateStaffMember', { method: 'POST', body: fd });
												await invalidateAll();
												editingMemberId = null;
												editSaving = false;
											}}>{editSaving ? 'Saving...' : 'Save'}</button>
											{#if member.status === 'active'}
												<button class="fr-btn fr-btn-sm" onclick={async (e) => {
													const btn = e.currentTarget as HTMLButtonElement;
													btn.disabled = true;
													btn.textContent = 'Sending...';
													await fetch('/api/auth/request-password-reset', {
														method: 'POST',
														headers: { 'Content-Type': 'application/json' },
														body: JSON.stringify({ email: member.email, redirectTo: `${window.location.origin}/reset-password` })
													});
													btn.textContent = 'Reset link sent';
													setTimeout(() => { btn.textContent = 'Reset password'; btn.disabled = false; }, 3000);
												}}>Reset password</button>
											{/if}
											<button class="fr-btn fr-btn-sm" onclick={() => editingMemberId = null}>Cancel</button>
											</div>
										</div>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	{/if}

	<!-- Integrations tab -->
	{#if activeTab === 'integrations'}
		{#if integrationError}
			<div style="padding: 12px 16px; margin-bottom: 14px; background: #fef2f2; border: 1px solid #fecaca; border-radius: var(--fr-radius); color: #991b1b; font-size: 13px; display: flex; align-items: center; gap: 10px">
				<span style="flex: 1">{integrationError}</span>
				<button style="background: none; border: none; cursor: pointer; color: #991b1b; font-size: 16px; padding: 0 4px" onclick={() => integrationError = null}>&times;</button>
			</div>
		{/if}
		{#if integrationSuccess}
			<div style="padding: 12px 16px; margin-bottom: 14px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--fr-radius); color: #166534; font-size: 13px; display: flex; align-items: center; gap: 10px">
				<span style="flex: 1">{integrationSuccess}</span>
				<button style="background: none; border: none; cursor: pointer; color: #166534; font-size: 16px; padding: 0 4px" onclick={() => integrationSuccess = null}>&times;</button>
			</div>
		{/if}
		<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px">
			{#each integrationCatalog as integ (integ.id)}
				{@const connected = connectedIntegrations.has(integ.id)}
				<div class="fr-card fr-card-pad" style="display: flex; gap: 14px; align-items: flex-start">
					<div style="width: 40px; height: 40px; border-radius: 10px; background: var(--fr-surface-muted); border: 1px solid var(--fr-border); display: grid; place-items: center; flex-shrink: 0">
						<span style="font-size: 16px; font-weight: 700; color: var(--fr-text-muted)">{integ.name.charAt(0)}</span>
					</div>
					<div style="flex: 1; min-width: 0">
						<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px">
							<span style="font-weight: 600; font-size: 14px">{integ.name}</span>
							<span class="fr-badge {connected ? 'confirmed' : 'cancelled'}">{connected ? 'Connected' : 'Available'}</span>
						</div>
						<div class="fr-subtle" style="font-size: 12.5px; line-height: 1.5">{integ.desc}</div>
						{#if integ.oauthProvider && data.restaurant}
							<div style="margin-top: 8px">
								{#if connected}
									<div style="display: flex; gap: 6px; flex-wrap: wrap">
										<button class="fr-btn fr-btn-sm" disabled={gmbSyncing} onclick={async () => {
											gmbSyncing = true;
											const fd = new FormData();
											fd.set('restaurantId', data.restaurant.id);
											await fetch('/dashboard/settings?/syncGmbReviews', { method: 'POST', body: fd });
											await invalidateAll();
											gmbSyncing = false;
										}}>{gmbSyncing ? 'Syncing...' : 'Sync reviews'}</button>
										<button class="fr-btn fr-btn-sm fr-btn-ghost" onclick={async () => {
											if (!confirm('Disconnect Google Business Profile?')) return;
											await fetch(`/api/v1/integrations/${integ.id}/disconnect`, {
												method: 'POST',
												headers: { 'Content-Type': 'application/json' },
												body: JSON.stringify({ restaurantId: data.restaurant.id })
											});
											await invalidateAll();
										}}>Disconnect</button>
									</div>
								{:else if gmbHasCredentials}
									<a
										class="fr-btn fr-btn-sm fr-btn-primary"
										href="/api/v1/integrations/{integ.id}/connect?restaurantId={data.restaurant.id}&returnUrl=/dashboard/settings"
									>Connect</a>
								{:else if showGmbSetup}
									<div style="margin-top: 4px; display: flex; flex-direction: column; gap: 8px">
										<div class="fr-subtle" style="font-size: 12px; line-height: 1.5">
											Enter your Google Cloud OAuth credentials. Create them at <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener" style="color: var(--fr-accent)">console.cloud.google.com</a> with the <strong>Business Profile</strong> API enabled.
										</div>
										<input class="fr-input" placeholder="Client ID" bind:value={gmbClientId} style="font-size: 12px" />
										<input class="fr-input" placeholder="Client Secret" type="password" bind:value={gmbClientSecret} style="font-size: 12px" />
										<div style="display: flex; gap: 6px">
											<button class="fr-btn fr-btn-sm fr-btn-primary" disabled={gmbSaving || !gmbClientId || !gmbClientSecret} onclick={async () => {
												gmbSaving = true;
												const fd = new FormData();
												fd.set('providerId', integ.id);
												fd.set('clientId', gmbClientId);
												fd.set('clientSecret', gmbClientSecret);
												await fetch('/dashboard/settings?/saveIntegrationCredentials', { method: 'POST', body: fd });
												await invalidateAll();
												gmbSaving = false;
												showGmbSetup = false;
												gmbClientId = '';
												gmbClientSecret = '';
											}}>{gmbSaving ? 'Saving...' : 'Save credentials'}</button>
											<button class="fr-btn fr-btn-sm" onclick={() => { showGmbSetup = false; gmbClientId = ''; gmbClientSecret = ''; }}>Cancel</button>
										</div>
									</div>
								{:else}
									<button class="fr-btn fr-btn-sm fr-btn-primary" onclick={() => showGmbSetup = true}>Set up connection</button>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Private dining tab -->
	{#if activeTab === 'private'}
		<div class="fr-card fr-card-pad" style="padding: 64px 20px">
			<div class="fr-empty">
				<div class="fr-empty-title">No private dining rooms configured</div>
				<p class="fr-subtle" style="margin-top: 6px; font-size: 13px">Add your first private dining space to accept group bookings with custom menus and pricing.</p>
				<button class="fr-btn fr-btn-primary" style="margin-top: 16px" onclick={() => showAddRoom = true}><Plus size={14} /> Add room</button>
			</div>
		</div>
	{/if}
</div>
{/if}

{#if showAddRoom}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fr-modal-overlay" onclick={() => showAddRoom = false}>
		<div class="fr-modal" style="width: 440px" onclick={(e) => e.stopPropagation()}>
			<div style="padding: 20px 24px; border-bottom: 1px solid var(--fr-border)">
				<h2 style="margin: 0; font-size: 18px; font-weight: 600">Add private dining room</h2>
			</div>
			<div style="padding: 24px; display: flex; flex-direction: column; gap: 16px">
				<div>
					<label class="fr-label" for="room-name">Room name</label>
					<input class="fr-input" id="room-name" type="text" bind:value={newRoomName} placeholder="The Cellar" />
				</div>
				<div>
					<label class="fr-label" for="room-desc">Description</label>
					<textarea class="fr-textarea" id="room-desc" rows="3" bind:value={newRoomDesc} placeholder="Describe this private dining space..."></textarea>
				</div>
				<div>
					<label class="fr-label" for="room-capacity">Capacity</label>
					<input class="fr-input" id="room-capacity" type="number" bind:value={newRoomCapacity} min="1" />
				</div>
			</div>
			<div style="padding: 16px 24px; border-top: 1px solid var(--fr-border); display: flex; justify-content: flex-end; gap: 8px">
				<button class="fr-btn" onclick={() => showAddRoom = false}>Cancel</button>
				<button class="fr-btn fr-btn-primary" onclick={async () => {
					const fd = new FormData();
					fd.set('name', newRoomName);
					fd.set('description', newRoomDesc);
					fd.set('capacity', newRoomCapacity);
					await fetch('/dashboard/settings?/createPrivateRoom', { method: 'POST', body: fd });
					await invalidateAll();
					showAddRoom = false;
					newRoomName = '';
					newRoomDesc = '';
					newRoomCapacity = '12';
				}}>Create room</button>
			</div>
		</div>
	</div>
{/if}
