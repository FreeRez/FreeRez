<script lang="ts">
	import { Search, Download, Plus, ChevronRight, X, Mail, Pencil, CalendarPlus, Check, Minus } from 'lucide-svelte';
	import type { NormalizedGuest, NormalizedReservation } from '$lib/server/dashboard/normalize';

	let { data } = $props();
	const guests: NormalizedGuest[] = $derived(data.guests);
	const reservations: NormalizedReservation[] = $derived(data.reservations);

	let selectedGuest = $state<NormalizedGuest | null>(null);
	let query = $state('');
	let activeChip = $state<string>('all');
	let showAddGuest = $state(false);
	let newFirstName = $state('');
	let newLastName = $state('');
	let newEmail = $state('');
	let newPhone = $state('');

	let addingTag = $state(false);
	let newTagName = $state('');

	let editingGuest = $state(false);
	let editFirstName = $state('');
	let editLastName = $state('');
	let editEmail = $state('');
	let editPhone = $state('');
	let editNotes = $state('');
	let savingGuest = $state(false);

	function startEditGuest(g: NormalizedGuest) {
		const parts = g.name.split(' ');
		editFirstName = parts[0] ?? '';
		editLastName = parts.slice(1).join(' ') ?? '';
		editEmail = g.email;
		editPhone = g.phone;
		editNotes = g.notes;
		editingGuest = true;
	}

	function cancelEditGuest() {
		editingGuest = false;
	}

	async function saveEditGuest() {
		if (!selectedGuest) return;
		savingGuest = true;
		try {
			const fd = new FormData();
			fd.set('guestId', selectedGuest.id);
			fd.set('firstName', editFirstName);
			fd.set('lastName', editLastName);
			fd.set('email', editEmail);
			fd.set('phone', editPhone);
			fd.set('notes', editNotes);
			await fetch('/dashboard/guests?/updateGuest', { method: 'POST', body: fd });
			const { invalidateAll } = await import('$app/navigation');
			await invalidateAll();
			editingGuest = false;
			selectedGuest = null;
		} finally {
			savingGuest = false;
		}
	}

	function exportCsv() {
		const header = 'Name,Email,Phone,Tags,Visits,Avg Spend,Last Visit,Email Opt-in';
		const rows = filtered.map(g =>
			[g.name, g.email, g.phone, g.tags.join('; '), g.visits, g.avgSpend, g.last, g.optIn ? 'Yes' : 'No']
				.map(v => `"${String(v).replace(/"/g, '""')}"`)
				.join(',')
		);
		const csv = [header, ...rows].join('\n');
		const blob = new Blob([csv], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'guests.csv';
		a.click();
		URL.revokeObjectURL(url);
	}

	async function saveNewGuest() {
		const fd = new FormData();
		fd.set('firstName', newFirstName);
		fd.set('lastName', newLastName);
		fd.set('email', newEmail);
		fd.set('phone', newPhone);
		await fetch('/dashboard/guests?/createGuest', { method: 'POST', body: fd });
		const { invalidateAll } = await import('$app/navigation');
		await invalidateAll();
		showAddGuest = false;
		newFirstName = '';
		newLastName = '';
		newEmail = '';
		newPhone = '';
	}

	const chips = ['all', 'Visit frequency', 'Marketing opt-in'] as const;

	const vipCount = $derived(guests.filter(g => g.tags.includes('VIP')).length);
	const criticCount = $derived(guests.filter(g => g.tags.includes('Critic') || g.tags.includes('Press')).length);

	const filtered = $derived.by(() => {
		let list = guests;
		if (activeChip === 'Visit frequency') {
			list = [...list].sort((a, b) => b.visits - a.visits);
		} else if (activeChip === 'Marketing opt-in') {
			list = list.filter(g => g.optIn);
		}
		if (query.trim()) {
			const q = query.trim().toLowerCase();
			list = list.filter(g =>
				g.name.toLowerCase().includes(q) ||
				g.email.toLowerCase().includes(q) ||
				g.phone.includes(q) ||
				g.tags.some(t => t.toLowerCase().includes(q))
			);
		}
		return list;
	});

	function initials(name: string) {
		return name.split(' ').map(s => s[0]).join('').slice(0, 2);
	}

	function guestReservations(guestName: string) {
		return reservations.filter(r => r.guest === guestName);
	}

	function isAccentTag(tag: string) {
		return ['VIP', 'Critic', 'Press'].includes(tag);
	}
</script>

<div class="fr-content">
	<div class="fr-page-head">
		<div>
			<h1 class="fr-page-title">Guests</h1>
			<p class="fr-page-sub">{guests.length} guests · {vipCount} VIPs · {criticCount} critics flagged</p>
		</div>
		<div class="fr-row" style="gap: 8px">
			<button class="fr-btn" onclick={exportCsv}><Download size={14} /> Export</button>
			<button class="fr-btn fr-btn-primary" onclick={() => showAddGuest = true}><Plus size={14} /> Add guest</button>
		</div>
	</div>

	<div class="fr-card">
		<div style="padding: 12px 16px; display: flex; flex-direction: column; gap: 10px">
			<div class="fr-row" style="gap: 6px; flex-wrap: wrap">
				{#each chips as chip (chip)}
					<button
						class="fr-chip"
						class:active={activeChip === chip}
						onclick={() => activeChip = chip}
					>
						{chip === 'all' ? 'All tags' : chip}
					</button>
				{/each}
			</div>
			<div class="fr-row" style="gap: 8px">
				<div class="fr-search" style="width: 220px">
					<Search size={14} />
					<input type="text" placeholder="Search guests..." bind:value={query} />
				</div>
			</div>
		</div>

		<table class="fr-table">
			<thead>
				<tr>
					<th>Guest</th>
					<th style="width: 150px">Contact</th>
					<th style="width: 180px">Tags</th>
					<th style="width: 70px; text-align: right">Visits</th>
					<th style="width: 90px; text-align: right">Avg spend</th>
					<th style="width: 100px">Last visit</th>
					<th style="width: 90px">Email opt-in</th>
					<th style="width: 28px"></th>
				</tr>
			</thead>
			<tbody>
				{#each filtered as g (g.id)}
					<tr onclick={() => selectedGuest = g}>
						<td>
							<div style="display: flex; align-items: center; gap: 10px">
								<div class="fr-avatar">{initials(g.name)}</div>
								<div>
									<div style="font-weight: 500">{g.name}</div>
									<div class="fr-subtle" style="font-size: 12px">{g.email}</div>
								</div>
							</div>
						</td>
						<td>
							<span class="fr-mono" style="font-size: 12.5px">{g.phone}</span>
						</td>
						<td>
							<div style="display: flex; gap: 4px; flex-wrap: wrap">
								{#each g.tags as tag (tag)}
									<span class="fr-tag" class:accent={isAccentTag(tag)}>{tag}</span>
								{/each}
								{#if g.tags.length === 0}
									<span class="fr-subtle">--</span>
								{/if}
							</div>
						</td>
						<td style="text-align: right">
							<span class="fr-num" style="font-weight: 600">{g.visits}</span>
						</td>
						<td style="text-align: right">
							<span class="fr-num">${g.avgSpend}</span>
						</td>
						<td>
							<span class="fr-subtle">{g.last}</span>
						</td>
						<td>
							{#if g.optIn}
								<span class="fr-badge confirmed"><Check size={12} /> Yes</span>
							{:else}
								<span class="fr-badge" style="opacity: 0.5"><Minus size={12} /> No</span>
							{/if}
						</td>
						<td style="text-align: right">
							<ChevronRight size={14} strokeWidth={1.4} />
						</td>
					</tr>
				{/each}
			</tbody>
		</table>

		{#if filtered.length === 0}
			<div style="padding: 48px 20px; text-align: center; color: var(--fr-text-muted); font-size: 14px">
				No guests match your search.
			</div>
		{/if}
	</div>
</div>

<!-- Guest Profile Drawer -->
{#if selectedGuest}
	{@const g = selectedGuest}
	{@const gRes = guestReservations(g.name)}

	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fr-drawer-overlay" onclick={() => selectedGuest = null}></div>
	<div class="fr-drawer">
		<!-- Header -->
		<div style="padding: 20px 24px; border-bottom: 1px solid var(--fr-border)">
			<div style="display: flex; align-items: flex-start; gap: 14px">
				<div class="fr-avatar-lg" style="width: 56px; height: 56px; font-size: 18px">{initials(g.name)}</div>
				<div style="flex: 1; min-width: 0">
					{#if editingGuest}
						<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px">
							<input class="fr-input" type="text" bind:value={editFirstName} placeholder="First name" />
							<input class="fr-input" type="text" bind:value={editLastName} placeholder="Last name" />
						</div>
						<input class="fr-input" type="email" bind:value={editEmail} placeholder="Email" style="margin-bottom: 6px" />
						<input class="fr-input" type="tel" bind:value={editPhone} placeholder="Phone" />
					{:else}
						<div style="display: flex; align-items: center; gap: 8px">
							<h2 style="font-weight: 600; font-size: 20px; margin: 0">{g.name}</h2>
							{#each g.tags.filter(t => isAccentTag(t)) as tag (tag)}
								<span class="fr-tag accent">{tag}</span>
							{/each}
						</div>
						<div class="fr-subtle" style="font-size: 13px; margin-top: 4px">{g.email}</div>
						<div class="fr-mono fr-subtle" style="font-size: 12.5px; margin-top: 2px">{g.phone}</div>
					{/if}
				</div>
				<button class="fr-btn fr-btn-ghost fr-btn-icon" onclick={() => { editingGuest = false; selectedGuest = null; }}>
					<X size={16} />
				</button>
			</div>
		</div>

		<div style="flex: 1; overflow: auto">
			<!-- Stats row -->
			<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: var(--fr-border); border-bottom: 1px solid var(--fr-border)">
				<div style="background: var(--fr-surface); padding: 14px 20px; text-align: center">
					<div class="fr-stat-label" style="font-size: 10.5px">Visits</div>
					<div class="fr-num" style="font-size: 20px; font-weight: 600; margin-top: 4px">{g.visits}</div>
				</div>
				<div style="background: var(--fr-surface); padding: 14px 20px; text-align: center">
					<div class="fr-stat-label" style="font-size: 10.5px">Avg spend</div>
					<div class="fr-num" style="font-size: 20px; font-weight: 600; margin-top: 4px">${g.avgSpend}</div>
				</div>
				<div style="background: var(--fr-surface); padding: 14px 20px; text-align: center">
					<div class="fr-stat-label" style="font-size: 10.5px">Last visit</div>
					<div style="font-size: 14px; font-weight: 500; margin-top: 6px">{g.last}</div>
				</div>
			</div>

			<!-- Notes -->
			<div style="padding: 20px 24px; border-bottom: 1px solid var(--fr-border)">
				<div class="fr-section-title" style="margin-bottom: 10px; font-size: 13px">Notes</div>
				{#if editingGuest}
					<textarea class="fr-input" rows="3" bind:value={editNotes} placeholder="Add notes about this guest..." style="resize: vertical; width: 100%"></textarea>
				{:else}
					<div style="background: var(--fr-surface-muted); padding: 12px; border-radius: var(--fr-radius); font-size: 13.5px; line-height: 1.5; font-style: {g.notes ? 'italic' : 'normal'}; color: {g.notes ? 'var(--fr-text)' : 'var(--fr-text-subtle)'}">
						{g.notes || 'No notes for this guest.'}
					</div>
				{/if}
			</div>

			<!-- Tags -->
			<div style="padding: 20px 24px; border-bottom: 1px solid var(--fr-border)">
				<div class="fr-section-title" style="margin-bottom: 10px; font-size: 13px">Tags</div>
				<div style="display: flex; gap: 6px; flex-wrap: wrap">
					{#each g.tags as tag (tag)}
						<span class="fr-tag" class:accent={isAccentTag(tag)}>{tag}</span>
					{/each}
					{#if addingTag}
						<div style="display: inline-flex; gap: 4px; align-items: center">
							<input class="fr-input" style="height: 22px; width: 100px; font-size: 11px; padding: 0 6px; border-radius: 4px" bind:value={newTagName} placeholder="Tag name..." />
							<button class="fr-btn fr-btn-sm fr-btn-ghost" style="height: 22px; padding: 0 4px" onclick={async () => {
								if (newTagName.trim() && g.id) {
									const fd = new FormData();
									fd.set('guestId', g.id);
									fd.set('tagName', newTagName.trim());
									await fetch('/dashboard/guests?/addTag', { method: 'POST', body: fd });
									const { invalidateAll } = await import('$app/navigation');
									await invalidateAll();
								}
								addingTag = false;
								newTagName = '';
							}}><Check size={10} /></button>
							<button class="fr-btn fr-btn-sm fr-btn-ghost" style="height: 22px; padding: 0 4px" onclick={() => { addingTag = false; newTagName = ''; }}><X size={10} /></button>
						</div>
					{:else}
						<button class="fr-btn fr-btn-sm fr-btn-ghost" style="font-size: 12px; padding: 2px 8px" onclick={() => addingTag = true}>
							<Plus size={12} /> Add tag
						</button>
					{/if}
				</div>
			</div>

			<!-- Visit history -->
			<div style="padding: 20px 24px">
				<div class="fr-section-title" style="margin-bottom: 10px; font-size: 13px">Visit history</div>
				{#if gRes.length > 0}
					<table class="fr-table" style="font-size: 13px">
						<thead>
							<tr>
								<th>Date</th>
								<th>Party</th>
								<th>Server</th>
								<th style="text-align: right">Spend</th>
							</tr>
						</thead>
						<tbody>
							{#each gRes as r (r.id)}
								<tr>
									<td>{r.date} {r.time}</td>
									<td>{r.party}</td>
									<td>{r.server}</td>
									<td style="text-align: right">
										<span class="fr-num">{r.spend != null ? `$${r.spend.toFixed(2)}` : '--'}</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{:else}
					<div class="fr-subtle" style="font-size: 13px">No visit history found.</div>
				{/if}
			</div>
		</div>

		<!-- Footer actions -->
		<div style="padding: 14px; border-top: 1px solid var(--fr-border); display: flex; gap: 8px">
			{#if editingGuest}
				<button class="fr-btn fr-btn-primary" style="flex: 1" onclick={saveEditGuest} disabled={savingGuest}>
					<Check size={14} /> {savingGuest ? 'Saving...' : 'Save changes'}
				</button>
				<button class="fr-btn" onclick={cancelEditGuest} disabled={savingGuest}><X size={14} /> Cancel</button>
			{:else}
				<button class="fr-btn fr-btn-ghost" onclick={() => { window.location.href = 'mailto:' + g.email; }}><Mail size={14} /> Email</button>
				<button class="fr-btn" onclick={() => startEditGuest(g)}><Pencil size={14} /> Edit profile</button>
				<div style="flex: 1"></div>
				<button class="fr-btn fr-btn-primary" onclick={() => { window.location.href = '/dashboard/reservations'; }}><CalendarPlus size={14} /> New reservation</button>
			{/if}
		</div>
	</div>
{/if}

<!-- Add Guest Modal -->
{#if showAddGuest}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fr-drawer-overlay" onclick={() => showAddGuest = false}></div>
	<div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--fr-surface); border: 1px solid var(--fr-border); border-radius: 12px; padding: 24px; width: 420px; max-width: 90vw; z-index: 1001; box-shadow: 0 20px 60px rgba(0,0,0,0.3)">
		<h2 style="font-weight: 600; font-size: 18px; margin: 0 0 20px">Add guest</h2>
		<div style="display: flex; flex-direction: column; gap: 14px">
			<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px">
				<label class="fr-label" style="display: flex; flex-direction: column; gap: 4px">
					First name
					<input class="fr-input" type="text" bind:value={newFirstName} placeholder="First name" />
				</label>
				<label class="fr-label" style="display: flex; flex-direction: column; gap: 4px">
					Last name
					<input class="fr-input" type="text" bind:value={newLastName} placeholder="Last name" />
				</label>
			</div>
			<label class="fr-label" style="display: flex; flex-direction: column; gap: 4px">
				Email
				<input class="fr-input" type="email" bind:value={newEmail} placeholder="guest@example.com" />
			</label>
			<label class="fr-label" style="display: flex; flex-direction: column; gap: 4px">
				Phone
				<input class="fr-input" type="tel" bind:value={newPhone} placeholder="+1 555 000 0000" />
			</label>
		</div>
		<div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px">
			<button class="fr-btn" onclick={() => showAddGuest = false}>Cancel</button>
			<button class="fr-btn fr-btn-primary" onclick={saveNewGuest}>Save</button>
		</div>
	</div>
{/if}
