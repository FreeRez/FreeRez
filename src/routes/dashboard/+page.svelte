<script lang="ts">
	import type { NormalizedReservation, NormalizedGuest } from '$lib/server/dashboard/normalize';
	import { Plus, Zap, ArrowRight, ChevronRight } from 'lucide-svelte';
	import ReservationDrawer from '$lib/components/dashboard/ReservationDrawer.svelte';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();
	const reservations: NormalizedReservation[] = $derived(data.reservations);
	const guests: NormalizedGuest[] = $derived(data.guests);

	let openRes = $state<NormalizedReservation | null>(null);
	let showBlockTable = $state(false);
	let blockTableId = $state('');
	let blockReason = $state('');

	const upcoming = $derived(reservations.filter(r => ['confirmed', 'seated'].includes(r.status)).slice(0, 6));
	const seated = $derived(reservations.filter(r => r.status === 'seated').length);
	const total = $derived(reservations.length);
	const covers = $derived(reservations.reduce((s, r) => s + r.party, 0));
	const noShow = $derived(reservations.filter(r => r.status === 'no-show').length);
	const completed = $derived(reservations.filter(r => r.status === 'completed').length);
	const confirmed = $derived(reservations.filter(r => r.status === 'confirmed').length);
	const tableCount = $derived(data.tableCount ?? 0);
	const lastWeekCovers = $derived(data.lastWeekCovers ?? 0);

	const coversDelta = $derived.by(() => {
		if (lastWeekCovers === 0) return null;
		const pct = Math.round(((covers - lastWeekCovers) / lastWeekCovers) * 100);
		return pct;
	});

	const today = new Date();
	const dayOfWeek = today.getDay();
	const dateLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
	const lastWeekLabel = today.toLocaleDateString('en-US', { weekday: 'long' });

	const shifts: Array<{ startTime: string; endTime: string; dayOfWeek: number; name: string }> = $derived(data.shifts ?? []);
	const nextShift = $derived.by(() => {
		const todayShifts = shifts.filter(s => s.dayOfWeek === dayOfWeek);
		if (todayShifts.length === 0) return null;
		const nowMinutes = today.getHours() * 60 + today.getMinutes();
		for (const s of todayShifts) {
			const [h, m] = s.startTime.split(':').map(Number);
			const startMin = h * 60 + m;
			if (startMin > nowMinutes) {
				const diff = startMin - nowMinutes;
				if (diff <= 120) {
					return { name: s.name, minutes: diff };
				}
			}
		}
		return null;
	});

	const recentActivity = $derived.by(() => {
		const sorted = [...reservations].sort((a, b) => {
			const aId = parseInt(a.id, 16) || 0;
			const bId = parseInt(b.id, 16) || 0;
			return bId - aId;
		});
		return sorted.slice(0, 6).map(r => {
			const statusText: Record<string, string> = {
				confirmed: 'Reservation confirmed',
				seated: 'Party seated',
				completed: 'Visit completed',
				'no-show': 'Marked no-show',
				cancelled: 'Reservation cancelled',
			};
			return {
				text: `${statusText[r.status] ?? r.status} — ${r.guest}, party of ${r.party} at ${r.time}.`,
				status: r.status,
				origin: r.origin,
				table: r.table,
			};
		});
	});

	const vips = $derived(guests.filter(g => g.tags?.includes('VIP') || g.tags?.includes('Critic') || g.tags?.includes('Press')).slice(0, 3));

	function initials(name: string) {
		return name.split(' ').map(s => s[0]).join('').slice(0, 2);
	}
</script>

<div class="fr-content">
	<div class="fr-page-head">
		<div>
			<h1 class="fr-page-title">{dateLabel}</h1>
			<p class="fr-page-sub">
				{confirmed} confirmed · {seated} currently seated{#if nextShift} · {nextShift.name} starts in {nextShift.minutes} min{/if}
			</p>
		</div>
		<div class="fr-row" style="gap: 8px">
			<button class="fr-btn" onclick={() => { window.location.href = '/dashboard/reservations?walk-in=true'; }}><Plus size={14} /> Walk-in</button>
			<button class="fr-btn" onclick={() => showBlockTable = true}><Zap size={14} /> Block table</button>
			<a href="/dashboard/reservations" class="fr-btn fr-btn-primary"><Plus size={14} /> New reservation</a>
		</div>
	</div>

	<!-- Stats row -->
	<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px">
		<div class="fr-stat">
			<div class="fr-stat-label">Covers tonight</div>
			<div class="fr-stat-value">{covers}</div>
			<div class="fr-stat-foot">
				{#if coversDelta !== null}
					<span class={coversDelta >= 0 ? 'fr-stat-delta-up' : 'fr-stat-delta-down'}>{coversDelta >= 0 ? '↑' : '↓'} {Math.abs(coversDelta)}%</span> vs last {lastWeekLabel}
				{:else}
					No data from last week
				{/if}
			</div>
		</div>
		<div class="fr-stat">
			<div class="fr-stat-label">Reservations</div>
			<div class="fr-stat-value">{total}</div>
			<div class="fr-stat-foot">{completed} completed · {seated} seated · {noShow} no-show</div>
		</div>
		<div class="fr-stat">
			<div class="fr-stat-label">Table occupancy</div>
			<div class="fr-stat-value">{tableCount > 0 ? Math.round((seated / tableCount) * 100) : 0}%</div>
			<div class="fr-stat-foot">{seated} of {tableCount} tables seated</div>
		</div>
		<div class="fr-stat">
			<div class="fr-stat-label">Avg party size</div>
			<div class="fr-stat-value">{total > 0 ? (covers / total).toFixed(1) : '—'}</div>
			<div class="fr-stat-foot">{covers} covers across {total} reservations</div>
		</div>
	</div>

	<!-- Up next + Activity -->
	<div style="display: grid; grid-template-columns: 1.4fr 1fr; gap: 18px">
		<div class="fr-card">
			<div class="fr-card-head">
				<div>
					<div class="fr-card-title">Up next</div>
					<div class="fr-card-sub">Next six covers in service order</div>
				</div>
				<a href="/dashboard/reservations" class="fr-btn fr-btn-sm fr-btn-ghost">All reservations <ArrowRight size={12} /></a>
			</div>
			{#if upcoming.length > 0}
				<table class="fr-table">
					<tbody>
						{#each upcoming as r (r.id)}
							<tr onclick={() => openRes = r}>
								<td style="width: 80px">
									<div style="font-weight: 600; font-size: 14px" class="fr-num">{r.time}</div>
								</td>
								<td>
									<div style="font-weight: 500">{r.guest}</div>
									<div class="fr-subtle" style="font-size: 11.5px; margin-top: 2px">
										Party of {r.party} · {r.area} {r.table}
										{#if r.tags.length > 0}
											<span> · {r.tags.join(', ')}</span>
										{/if}
									</div>
								</td>
								<td style="width: 110px">
									<span class="fr-badge {r.status}">{r.status}</span>
								</td>
								<td style="width: 28px; text-align: right">
									<ChevronRight size={14} strokeWidth={1.4} />
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<div style="padding: 32px 20px; text-align: center; color: var(--fr-text-muted); font-size: 13px">
					No upcoming reservations today.
				</div>
			{/if}
		</div>

		<div class="fr-card">
			<div class="fr-card-head">
				<div class="fr-card-title">Today's activity</div>
			</div>
			{#if recentActivity.length > 0}
				<div style="padding: 8px 0">
					{#each recentActivity as a, i (i)}
						<div style="display: flex; gap: 10px; padding: 10px 20px; {i ? 'border-top: 1px solid var(--fr-border)' : ''}">
							<div style="width: 26px; height: 26px; border-radius: 999px; display: grid; place-items: center; background: {a.status === 'confirmed' ? 'var(--fr-accent-soft)' : a.status === 'no-show' ? 'color-mix(in oklch, var(--fr-warn) 12%, transparent)' : 'var(--fr-surface-muted)'}; color: {a.status === 'confirmed' ? 'var(--fr-accent)' : a.status === 'no-show' ? 'var(--fr-warn)' : 'var(--fr-text-muted)'}; flex-shrink: 0; border: 1px solid var(--fr-border)">
								<span style="font-size: 10px; font-weight: 600">
									{#if a.status === 'confirmed'}+{:else if a.status === 'seated'}●{:else if a.status === 'completed'}✓{:else if a.status === 'no-show'}✗{:else}–{/if}
								</span>
							</div>
							<div style="flex: 1; min-width: 0">
								<div style="font-size: 12.5px; line-height: 1.4">{a.text}</div>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div style="padding: 32px 20px; text-align: center; color: var(--fr-text-muted); font-size: 13px">
					No activity yet today.
				</div>
			{/if}
		</div>
	</div>

	<!-- VIPs -->
	{#if vips.length > 0}
		<div class="fr-section-head">
			<div>
				<div class="fr-section-title">VIPs in tonight</div>
				<div class="fr-section-sub">Auto-flagged from guest tags and visit history</div>
			</div>
		</div>
		<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px">
			{#each vips as g (g.id)}
				<div class="fr-card fr-card-pad" style="display: flex; gap: 14px; align-items: flex-start">
					<div class="fr-avatar-lg">{initials(g.name)}</div>
					<div style="flex: 1; min-width: 0">
						<div style="display: flex; align-items: center; gap: 6px">
							<div style="font-weight: 600">{g.name}</div>
							{#if g.tags.includes('VIP')}
								<span class="fr-tag accent">VIP</span>
							{/if}
							{#if g.tags.includes('Critic')}
								<span class="fr-tag accent">Press</span>
							{/if}
						</div>
						<div class="fr-subtle" style="font-size: 11.5px; margin-top: 2px">{g.visits} visits · ${g.avgSpend} avg{#if g.last} · last {g.last}{/if}</div>
						<div style="font-size: 12.5px; margin-top: 8px; color: var(--fr-text-muted); line-height: 1.5">{g.notes || '—'}</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if showBlockTable}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div style="position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,0.4); display: grid; place-items: center" onclick={() => showBlockTable = false}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div style="background: var(--fr-surface); border: 1px solid var(--fr-border); border-radius: var(--fr-radius); box-shadow: var(--fr-shadow-lg); width: 400px; padding: 24px" onclick={(e) => e.stopPropagation()}>
			<div style="font-weight: 600; font-size: 16px; margin-bottom: 20px">Block table</div>
			<div style="display: flex; flex-direction: column; gap: 14px">
				<div>
					<label class="fr-label" for="block-table-id">Table number</label>
					<input class="fr-input" id="block-table-id" type="text" bind:value={blockTableId} placeholder="e.g. A1, B3" />
				</div>
				<div>
					<label class="fr-label" for="block-reason">Reason <span style="color: var(--fr-text-muted); font-weight: 400">(optional)</span></label>
					<input class="fr-input" id="block-reason" type="text" bind:value={blockReason} placeholder="e.g. Maintenance, reserved for event" />
				</div>
			</div>
			<div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px">
				<button class="fr-btn" onclick={() => { showBlockTable = false; blockTableId = ''; blockReason = ''; }}>Cancel</button>
				<button class="fr-btn fr-btn-primary" onclick={async () => {
					if (!blockTableId.trim()) return;
					const fd = new FormData();
					fd.set('tableNumber', blockTableId.trim());
					fd.set('reason', blockReason.trim());
					await fetch('/dashboard/floor?/blockTable', { method: 'POST', body: fd });
					await invalidateAll();
					showBlockTable = false;
					blockTableId = '';
					blockReason = '';
				}}>Block</button>
			</div>
		</div>
	</div>
{/if}

{#if openRes}
	<ReservationDrawer res={openRes} onclose={() => openRes = null} />
{/if}
