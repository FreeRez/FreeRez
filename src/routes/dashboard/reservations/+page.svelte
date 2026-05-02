<script lang="ts">
	import { Search, SlidersHorizontal, Download, Plus, ChevronRight, List, LayoutGrid } from 'lucide-svelte';
	import type { NormalizedReservation } from '$lib/server/dashboard/normalize';
	import ReservationDrawer from '$lib/components/dashboard/ReservationDrawer.svelte';
	import NewReservationModal from '$lib/components/dashboard/NewReservationModal.svelte';
	import ReservationTimeline from '$lib/components/dashboard/ReservationTimeline.svelte';

	let { data } = $props();
	const reservations: NormalizedReservation[] = $derived(data.reservations);

	let openRes = $state<NormalizedReservation | null>(null);
	let showNewRes = $state(false);
	let viewMode = $state<'list' | 'timeline'>('list');
	let prefillTable = $state('');
	let prefillTime = $state('');
	let activeFilter = $state<string>('all');
	let query = $state('');
	let showFilters = $state(false);
	let filterOrigin = $state('');
	let filterServer = $state('');
	let filterArea = $state('');

	const statuses = ['all', 'confirmed', 'seated', 'completed', 'no-show'] as const;

	const counts = $derived({
		all: reservations.length,
		confirmed: reservations.filter(r => r.status === 'confirmed').length,
		seated: reservations.filter(r => r.status === 'seated').length,
		completed: reservations.filter(r => r.status === 'completed').length,
		'no-show': reservations.filter(r => r.status === 'no-show').length
	});

	const filtered = $derived.by(() => {
		let list = reservations;
		if (activeFilter !== 'all') {
			list = list.filter(r => r.status === activeFilter);
		}
		if (query.trim()) {
			const q = query.trim().toLowerCase();
			list = list.filter(r =>
				r.guest.toLowerCase().includes(q) ||
				r.conf.toLowerCase().includes(q) ||
				r.table.toLowerCase().includes(q) ||
				r.server.toLowerCase().includes(q)
			);
		}
		if (filterOrigin) list = list.filter(r => r.origin === filterOrigin);
		if (filterServer) list = list.filter(r => r.server.toLowerCase().includes(filterServer.toLowerCase()));
		if (filterArea) list = list.filter(r => r.area.toLowerCase().includes(filterArea.toLowerCase()));
		return list;
	});

	const today = new Date();
	const dateLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

	function chipLabel(s: string) {
		if (s === 'all') return 'All';
		if (s === 'no-show') return 'No-show';
		return s.charAt(0).toUpperCase() + s.slice(1);
	}
</script>

<div class="fr-content">
	<div class="fr-page-head">
		<div>
			<h1 class="fr-page-title">Reservations</h1>
			<p class="fr-page-sub">{dateLabel} · {reservations.length} reservations</p>
		</div>
		<div class="fr-row" style="gap: 8px">
			<div class="fr-segment">
				<button class:active={viewMode === 'list'} onclick={() => viewMode = 'list'}>
					<List size={14} /> List
				</button>
				<button class:active={viewMode === 'timeline'} onclick={() => viewMode = 'timeline'}>
					<LayoutGrid size={14} /> Timeline
				</button>
			</div>
			<button class="fr-btn" onclick={() => {
				const csv = ['Time,Guest,Party,Area,Table,Status,Server,Conf'].concat(
					filtered.map(r => `${r.time},"${r.guest}",${r.party},${r.area},${r.table},${r.status},${r.server},${r.conf}`)
				).join('\n');
				const blob = new Blob([csv], { type: 'text/csv' });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = 'reservations.csv';
				a.click();
				URL.revokeObjectURL(url);
			}}><Download size={14} /> Export</button>
			<button class="fr-btn fr-btn-primary" onclick={() => showNewRes = true}><Plus size={14} /> New reservation</button>
		</div>
	</div>

	{#if viewMode === 'timeline'}
		<ReservationTimeline
			{reservations}
			tables={data.tables ?? []}
			shifts={data.shifts ?? []}
			diningAreas={data.diningAreas ?? []}
			onSelectReservation={(res) => openRes = res}
			onCreateReservation={(tableNumber, time) => {
				prefillTable = tableNumber;
				prefillTime = time;
				showNewRes = true;
			}}
			onMoveReservation={async (reservationId, newTime, newTable) => {
				const fd = new FormData();
				fd.set('reservationId', reservationId);
				const res = reservations.find(r => r.id === reservationId);
				if (!res) return;
				const newScheduledTime = `${res.date}T${newTime}:00`;
				fd.set('scheduledTime', newScheduledTime);
				fd.set('tableNumber', JSON.stringify([newTable]));
				await fetch('/dashboard/reservations?/updateReservation', { method: 'POST', body: fd });
				const { invalidateAll } = await import('$app/navigation');
				await invalidateAll();
			}}
		/>
	{:else}
	<div class="fr-card">
		<div style="padding: 12px 16px; display: flex; flex-direction: column; gap: 10px">
			<div class="fr-row" style="gap: 6px; flex-wrap: wrap">
				{#each statuses as s (s)}
					<button
						class="fr-chip"
						class:active={activeFilter === s}
						onclick={() => activeFilter = s}
					>
						{chipLabel(s)}
						<span class="fr-chip-count">{counts[s]}</span>
					</button>
				{/each}
			</div>
			<div class="fr-row" style="gap: 8px">
				<div class="fr-search" style="width: 240px">
					<Search size={14} />
					<input type="text" placeholder="Search guests, tables, conf..." bind:value={query} />
				</div>
				<button class="fr-btn fr-btn-sm" onclick={() => showFilters = !showFilters}><SlidersHorizontal size={14} /> Filters</button>
			</div>
		</div>

		{#if showFilters}
			<div style="padding: 12px 16px; border-top: 1px solid var(--fr-border); display: flex; gap: 12px; align-items: end; flex-wrap: wrap">
				<div>
					<label class="fr-label" for="filter-origin">Origin</label>
					<select class="fr-select" id="filter-origin" style="width: 140px; height: 30px" bind:value={filterOrigin}>
						<option value="">All</option>
						<option>Web</option>
						<option>Phone/In-house</option>
						<option>Walk-in</option>
						<option>Partner</option>
					</select>
				</div>
				<div>
					<label class="fr-label" for="filter-server">Server</label>
					<input class="fr-input" id="filter-server" style="width: 120px; height: 30px" bind:value={filterServer} placeholder="Any" />
				</div>
				<div>
					<label class="fr-label" for="filter-area">Area</label>
					<select class="fr-select" id="filter-area" style="width: 140px; height: 30px" bind:value={filterArea}>
						<option value="">All</option>
						<option>Main</option>
						<option>Bar</option>
						<option>Garden</option>
						<option>Private</option>
					</select>
				</div>
				<button class="fr-btn fr-btn-sm" onclick={() => { filterOrigin = ''; filterServer = ''; filterArea = ''; }}>Clear</button>
			</div>
		{/if}

		<table class="fr-table">
			<thead>
				<tr>
					<th style="width: 72px">Time</th>
					<th>Guest</th>
					<th style="width: 60px">Party</th>
					<th style="width: 120px">Area / Table</th>
					<th style="width: 110px">Status</th>
					<th style="width: 80px">Origin</th>
					<th style="width: 80px">Server</th>
					<th style="width: 200px">Note</th>
					<th style="width: 110px">Conf #</th>
					<th style="width: 28px"></th>
				</tr>
			</thead>
			<tbody>
				{#each filtered as r (r.id)}
					<tr onclick={() => openRes = r}>
						<td>
							<span class="fr-num" style="font-weight: 600">{r.time}</span>
						</td>
						<td>
							<div style="display: flex; align-items: center; gap: 6px">
								<span style="font-weight: 500">{r.guest}</span>
								{#each r.tags as tag (tag)}
									<span class="fr-tag accent">{tag}</span>
								{/each}
							</div>
						</td>
						<td>
							<span class="fr-num">{r.party}</span>
						</td>
						<td>
							<span>{r.area}</span>
							<span class="fr-muted" style="margin-left: 4px">{r.table}</span>
						</td>
						<td>
							<span class="fr-badge {r.status}">{r.status}</span>
						</td>
						<td>
							<span class="fr-subtle">{r.origin}</span>
						</td>
						<td>
							<span class="fr-subtle">{r.server}</span>
						</td>
						<td>
							<span class="fr-truncate" style="max-width: 190px; display: inline-block">{r.note || '—'}</span>
						</td>
						<td>
							<span class="fr-mono fr-subtle" style="font-size: 12px">{r.conf}</span>
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
				No reservations match your filters.
			</div>
		{/if}
	</div>
	{/if}
</div>

{#if openRes}
	<ReservationDrawer res={openRes} onclose={() => openRes = null} servers={data.servers ?? []} />
{/if}

{#if showNewRes}
	<NewReservationModal
		onclose={() => { showNewRes = false; prefillTable = ''; prefillTime = ''; }}
		{prefillTable}
		{prefillTime}
	/>
{/if}
