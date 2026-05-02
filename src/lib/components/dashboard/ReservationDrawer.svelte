<script lang="ts">
	import { X, Edit, Check } from 'lucide-svelte';
	import { invalidateAll } from '$app/navigation';
	import type { NormalizedReservation } from '$lib/server/dashboard/normalize';

	let { res, onclose, servers = [] }: {
		res: NormalizedReservation;
		onclose: () => void;
		servers?: Array<{ staffId: string; name: string | null }>;
	} = $props();

	let editing = $state(false);
	let editParty = $state(0);
	let editNote = $state('');
	let editServer = $state('');
	let saving = $state(false);

	async function updateStatus(newState: string) {
		const formData = new FormData();
		formData.set('reservationId', res.id);
		formData.set('state', newState);
		await fetch('/dashboard/reservations?/updateStatus', {
			method: 'POST',
			body: formData
		});
		await invalidateAll();
		onclose();
	}

	function startEdit() {
		editParty = res.party;
		editNote = res.note;
		editServer = res.server === '—' ? '' : res.server;
		editing = true;
	}

	function cancelEdit() {
		editing = false;
	}

	async function saveEdit() {
		saving = true;
		try {
			const fd = new FormData();
			fd.set('reservationId', res.id);
			fd.set('partySize', String(editParty));
			fd.set('server', editServer);
			fd.set('guestRequest', editNote);
			await fetch('/dashboard/reservations?/updateReservation', { method: 'POST', body: fd });
			await invalidateAll();
			editing = false;
			onclose();
		} finally {
			saving = false;
		}
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fr-drawer-overlay" onclick={onclose}></div>
<div class="fr-drawer">
	<div style="padding: 20px 24px; border-bottom: 1px solid var(--fr-border)">
		<div style="display: flex; align-items: center; gap: 10px">
			<span class="fr-badge {res.status}">{res.status}</span>
			<span class="fr-mono fr-subtle" style="font-size: 12px">{res.conf}</span>
			<div style="flex: 1"></div>
			<button class="fr-btn fr-btn-ghost fr-btn-icon" onclick={onclose}><X size={16} /></button>
		</div>
		<h2 style="margin: 12px 0 4px; font-weight: 600; font-size: 22px">{res.guest}</h2>
		{#if editing}
			<div class="fr-subtle" style="font-size: 13px">{res.date} at {res.time} · {res.area} {res.table}</div>
		{:else}
			<div class="fr-subtle" style="font-size: 13px">Party of {res.party} · {res.date} at {res.time} · {res.area} {res.table}</div>
		{/if}
	</div>

	<div style="flex: 1; overflow: auto">
		<!-- Contact info -->
		<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1px; background: var(--fr-border); border-bottom: 1px solid var(--fr-border)">
			<div style="background: var(--fr-surface); padding: 14px 20px">
				<div class="fr-stat-label" style="font-size: 10.5px">Email</div>
				<div style="font-size: 13px; margin-top: 4px">{res.email}</div>
			</div>
			<div style="background: var(--fr-surface); padding: 14px 20px">
				<div class="fr-stat-label" style="font-size: 10.5px">Phone</div>
				<div class="fr-mono" style="font-size: 13px; margin-top: 4px">{res.phone}</div>
			</div>
		</div>

		<!-- Editable fields -->
		{#if editing}
			<div style="padding: 20px 24px; border-bottom: 1px solid var(--fr-border); display: flex; flex-direction: column; gap: 14px">
				<label class="fr-label" style="display: flex; flex-direction: column; gap: 4px; font-size: 13px">
					Party size
					<input class="fr-input" type="number" min="1" max="99" bind:value={editParty} />
				</label>
				<label class="fr-label" style="display: flex; flex-direction: column; gap: 4px; font-size: 13px">
					Server
					{#if servers.length > 0}
						<select class="fr-input" bind:value={editServer}>
							<option value="">Unassigned</option>
							{#each servers as s (s.staffId)}
								<option value={s.name ?? ''}>{s.name ?? 'Unknown'}</option>
							{/each}
						</select>
					{:else}
						<input class="fr-input" type="text" bind:value={editServer} placeholder="Assign a server..." />
					{/if}
				</label>
				<label class="fr-label" style="display: flex; flex-direction: column; gap: 4px; font-size: 13px">
					Special request
					<textarea class="fr-input" rows="3" bind:value={editNote} placeholder="No request from guest." style="resize: vertical"></textarea>
				</label>
			</div>
		{:else}
			<!-- Special request -->
			<div style="padding: 20px 24px; border-bottom: 1px solid var(--fr-border)">
				<div class="fr-section-title" style="margin-bottom: 10px; font-size: 13px">Special request</div>
				<div style="background: var(--fr-surface-muted); padding: 12px; border-radius: var(--fr-radius); font-size: 13.5px; line-height: 1.5; font-style: {res.note ? 'italic' : 'normal'}; color: {res.note ? 'var(--fr-text)' : 'var(--fr-text-subtle)'}">
					{res.note || 'No request from guest.'}
				</div>
			</div>
		{/if}

		<!-- Visit tags -->
		{#if res.tags.length > 0}
			<div style="padding: 20px 24px; border-bottom: 1px solid var(--fr-border)">
				<div class="fr-section-title" style="margin-bottom: 10px; font-size: 13px">Visit tags</div>
				<div style="display: flex; gap: 6px; flex-wrap: wrap">
					{#each res.tags as tag (tag)}
						<span class="fr-tag accent">{tag}</span>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Experience -->
		{#if res.exp}
			<div style="padding: 20px 24px; border-bottom: 1px solid var(--fr-border)">
				<div class="fr-section-title" style="margin-bottom: 10px; font-size: 13px">Experience</div>
				<div style="display: flex; justify-content: space-between; padding: 12px; background: var(--fr-accent-soft); border-radius: var(--fr-radius)">
					<div style="font-weight: 600">{res.exp.name}</div>
					<div class="fr-num" style="font-weight: 600">${res.exp.total}</div>
				</div>
			</div>
		{/if}

		<!-- Timeline -->
		<div style="padding: 20px 24px; border-bottom: 1px solid var(--fr-border)">
			<div class="fr-section-title" style="margin-bottom: 10px; font-size: 13px">Timeline</div>
			<div style="display: flex; flex-direction: column; gap: 10px">
				<div style="display: flex; gap: 10px; align-items: flex-start; font-size: 13px">
					<div style="width: 8px; height: 8px; border-radius: 999px; background: var(--fr-accent); margin-top: 6px"></div>
					<div style="flex: 1">
						<div>Booked online via diner widget</div>
						<div class="fr-subtle" style="font-size: 11.5px">14:22 yesterday</div>
					</div>
				</div>
				<div style="display: flex; gap: 10px; align-items: flex-start; font-size: 13px">
					<div style="width: 8px; height: 8px; border-radius: 999px; background: var(--fr-accent); margin-top: 6px"></div>
					<div style="flex: 1">
						<div>Confirmation reminder sent (email + SMS)</div>
						<div class="fr-subtle" style="font-size: 11.5px">08:15 today</div>
					</div>
				</div>
				{#if res.status === 'seated'}
					<div style="display: flex; gap: 10px; align-items: flex-start; font-size: 13px">
						<div style="width: 8px; height: 8px; border-radius: 999px; background: var(--fr-accent); margin-top: 6px"></div>
						<div style="flex: 1">
							<div>Seated by Marco</div>
							<div class="fr-subtle" style="font-size: 11.5px">17:42</div>
						</div>
					</div>
				{/if}
			</div>
		</div>

	</div>

	<!-- Actions -->
	<div style="padding: 14px; border-top: 1px solid var(--fr-border); display: flex; gap: 8px">
		{#if editing}
			<button class="fr-btn fr-btn-primary" style="flex: 1" onclick={saveEdit} disabled={saving}>
				<Check size={14} /> {saving ? 'Saving...' : 'Save changes'}
			</button>
			<button class="fr-btn" onclick={cancelEdit} disabled={saving}><X size={14} /> Cancel</button>
		{:else}
			{#if res.status === 'confirmed'}
				<button class="fr-btn fr-btn-primary" style="flex: 1" onclick={() => updateStatus('Seated')}><Check size={14} /> Seat now</button>
			{/if}
			{#if res.status === 'seated'}
				<button class="fr-btn fr-btn-primary" style="flex: 1" onclick={() => updateStatus('Completed')}><Check size={14} /> Complete</button>
			{/if}
			<button class="fr-btn" onclick={startEdit}><Edit size={14} /> Edit</button>
			<button class="fr-btn" onclick={() => updateStatus('Cancelled')}><X size={14} /> Cancel</button>
		{/if}
	</div>
</div>
