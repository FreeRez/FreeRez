<script lang="ts">
	import { ChevronDown, ChevronRight } from 'lucide-svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { getReservationDuration } from '$lib/shared/reservation-duration';
	import type { NormalizedReservation, NormalizedTable, NormalizedShift } from '$lib/server/dashboard/normalize';

	const SLOT_W = 56;
	const INFO_W = 120;

	let {
		reservations,
		tables,
		shifts,
		diningAreas,
		onSelectReservation,
		onCreateReservation,
		onMoveReservation,
	}: {
		reservations: NormalizedReservation[];
		tables: NormalizedTable[];
		shifts: NormalizedShift[];
		diningAreas: Array<{ id: string; name: string }>;
		onSelectReservation: (res: NormalizedReservation) => void;
		onCreateReservation: (tableNumber: string, time: string) => void;
		onMoveReservation: (reservationId: string, newTime: string, newTable: string) => Promise<void>;
	} = $props();

	let todayDow = $derived(new Date().getDay());
	let todayShifts = $derived(shifts.filter((s) => s.dayOfWeek === todayDow));
	let selectedShiftId = $state<string | null>(null);

	let activeShift = $derived.by(() => {
		if (todayShifts.length === 0) return null;
		return todayShifts.find((s) => s.id === selectedShiftId) ?? todayShifts[0];
	});

	function parseTime(t: string): number {
		const [h, m] = t.split(':').map(Number);
		return h * 60 + m;
	}

	function formatTime(minutes: number): string {
		const h = Math.floor(minutes / 60);
		const m = minutes % 60;
		return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
	}

	let shiftStartMin = $derived(activeShift ? parseTime(activeShift.start) : 11 * 60);
	let shiftEndMin = $derived(activeShift ? parseTime(activeShift.end) : 23 * 60);

	const PADDING_BEFORE = 2 * 60;
	const PADDING_AFTER = 3 * 60;
	let gridStartMin = $derived(Math.max(0, shiftStartMin - PADDING_BEFORE));
	let gridEndMin = $derived(Math.min(24 * 60, shiftEndMin + PADDING_AFTER));

	let slots = $derived.by(() => {
		const result: { time: string; minutes: number }[] = [];
		for (let m = gridStartMin; m < gridEndMin; m += 15) {
			result.push({ time: formatTime(m), minutes: m });
		}
		return result;
	});

	let totalW = $derived(INFO_W + slots.length * SLOT_W);

	let scrollEl = $state<HTMLDivElement | null>(null);

	let collapsedAreas = new SvelteSet<string>();

	function toggleArea(area: string) {
		if (collapsedAreas.has(area)) collapsedAreas.delete(area);
		else collapsedAreas.add(area);
	}

	let areaGroups = $derived.by(() => {
		const map = new Map<string, NormalizedTable[]>();
		for (const t of tables) {
			if (!t.active) continue;
			if (!map.has(t.area)) map.set(t.area, []);
			map.get(t.area)!.push(t);
		}
		const groups: { area: string; tables: NormalizedTable[] }[] = [];
		for (const [area, areaTables] of map) {
			groups.push({ area, tables: areaTables.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })) });
		}
		return groups;
	});

	let activeReservations = $derived(reservations.filter((r) => r.status !== 'cancelled'));

	type Block = { reservation: NormalizedReservation; left: number; width: number };

	function blocksFor(tableId: string): Block[] {
		const out: Block[] = [];
		for (const r of activeReservations) {
			if (!r.tableNumbers.includes(tableId)) continue;
			const start = (parseTime(r.time) - gridStartMin) / 15;
			const span = getReservationDuration(r.party) / 15;
			if (start < 0 || start >= slots.length) continue;
			out.push({ reservation: r, left: INFO_W + start * SLOT_W, width: span * SLOT_W - 2 });
		}
		return out;
	}

	let unassigned = $derived(activeReservations.filter((r) => r.tableNumbers.length === 0));

	function unassignedBlocks(): Block[] {
		const out: Block[] = [];
		for (const r of unassigned) {
			const start = (parseTime(r.time) - gridStartMin) / 15;
			const span = getReservationDuration(r.party) / 15;
			if (start < 0 || start >= slots.length) continue;
			out.push({ reservation: r, left: INFO_W + start * SLOT_W, width: span * SLOT_W - 2 });
		}
		return out;
	}

	let nowMinutes = $state(new Date().getHours() * 60 + new Date().getMinutes());

	$effect(() => {
		const iv = setInterval(() => { nowMinutes = new Date().getHours() * 60 + new Date().getMinutes(); }, 60_000);
		return () => clearInterval(iv);
	});

	let nowLeft = $derived(INFO_W + ((nowMinutes - gridStartMin) / 15) * SLOT_W);
	let showNow = $derived(nowMinutes >= gridStartMin && nowMinutes < gridEndMin);

	$effect(() => {
		if (scrollEl) {
			const pos = ((nowMinutes - gridStartMin) / 15) * SLOT_W;
			scrollEl.scrollLeft = Math.max(0, pos - scrollEl.clientWidth / 3);
		}
	});

	let slotSummary = $derived(slots.map((slot) => {
		let parties = 0, covers = 0;
		for (const r of activeReservations) {
			const s = parseTime(r.time), e = s + getReservationDuration(r.party);
			if (slot.minutes >= s && slot.minutes < e) { parties++; covers += r.party; }
		}
		return { parties, covers };
	}));

	let maxCovers = $derived(Math.max(1, ...slotSummary.map((s) => s.covers)));

	function handleRowClick(e: MouseEvent, tableId: string) {
		if ((e.target as HTMLElement).closest('.tl-block')) return;
		const row = e.currentTarget as HTMLElement;
		const clickX = e.clientX - row.getBoundingClientRect().left + (scrollEl?.scrollLeft ?? 0);
		const slotIndex = Math.floor((clickX - INFO_W) / SLOT_W);
		if (slotIndex < 0 || slotIndex >= slots.length) return;
		onCreateReservation(tableId, slots[slotIndex].time);
	}

	function statusIcon(status: string): string {
		if (status === 'completed') return '✓';
		if (status === 'no-show') return '✗';
		return '●';
	}

	/* ── Drag and drop ────────────────────────────────── */

	type DragState = {
		reservation: NormalizedReservation;
		startX: number;
		startY: number;
		origLeft: number;
		origTop: number;
		currentLeft: number;
		currentTop: number;
		width: number;
		dragging: boolean;
	};

	let drag = $state<DragState | null>(null);
	let confirmMove = $state<{ reservation: NormalizedReservation; newTime: string; oldTime: string; newTable: string; oldTable: string } | null>(null);
	let saving = $state(false);

	function onBlockMouseDown(e: MouseEvent, block: Block) {
		if (e.button !== 0) return;
		if (block.reservation.status === 'completed' || block.reservation.status === 'no-show') return;
		e.preventDefault();
		e.stopPropagation();
		const el = e.currentTarget as HTMLElement;
		const rect = el.getBoundingClientRect();
		drag = {
			reservation: block.reservation,
			startX: e.clientX,
			startY: e.clientY,
			origLeft: block.left,
			origTop: rect.top,
			currentLeft: block.left,
			currentTop: rect.top,
			width: block.width,
			dragging: false,
		};

		function onMove(ev: MouseEvent) {
			if (!drag) return;
			const dx = ev.clientX - drag.startX;
			const dy = ev.clientY - drag.startY;
			if (!drag.dragging && Math.abs(dx) + Math.abs(dy) > 5) {
				drag.dragging = true;
			}
			if (drag.dragging) {
				drag.currentLeft = drag.origLeft + dx;
				drag.currentTop = drag.origTop + dy;
			}
		}

		function onUp(ev: MouseEvent) {
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
			if (!drag || !drag.dragging) {
				if (drag && !drag.dragging) onSelectReservation(drag.reservation);
				drag = null;
				return;
			}

			const scrollRect = scrollEl?.getBoundingClientRect();
			if (!scrollRect) { drag = null; return; }

			const dropX = ev.clientX - scrollRect.left + (scrollEl?.scrollLeft ?? 0);
			const dropY = ev.clientY - scrollRect.top + (scrollEl?.scrollTop ?? 0);

			const slotIndex = Math.floor((dropX - INFO_W) / SLOT_W);
			if (slotIndex < 0 || slotIndex >= slots.length) { drag = null; return; }
			const newTime = slots[slotIndex].time;

			// Find which table row the block was dropped on
			let newTable = drag.reservation.tableNumbers[0] ?? '';
			const rows = scrollEl?.querySelectorAll('.tl-table-row');
			if (rows) {
				for (const row of rows) {
					const rowRect = row.getBoundingClientRect();
					const rowTop = rowRect.top - scrollRect.top + (scrollEl?.scrollTop ?? 0);
					if (dropY >= rowTop && dropY < rowTop + rowRect.height) {
						const tnum = row.querySelector('.tl-tnum');
						if (tnum?.textContent) newTable = tnum.textContent.trim();
						break;
					}
				}
			}

			const oldTime = drag.reservation.time;
			const oldTable = drag.reservation.tableNumbers[0] ?? '';

			if (newTime === oldTime && newTable === oldTable) {
				drag = null;
				return;
			}

			confirmMove = {
				reservation: drag.reservation,
				newTime,
				oldTime,
				newTable,
				oldTable,
			};
			drag = null;
		}

		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
	}

	async function confirmMoveReservation() {
		if (!confirmMove) return;
		saving = true;
		await onMoveReservation(confirmMove.reservation.id, confirmMove.newTime, confirmMove.newTable);
		saving = false;
		confirmMove = null;
	}

	function cancelMove() {
		confirmMove = null;
	}
</script>

<div class="fr-card tl-wrap">
	{#if todayShifts.length > 1}
		<div class="tl-shift-bar">
			<div class="fr-segment">
				{#each todayShifts as shift (shift.id)}
					<button class:active={activeShift?.id === shift.id} onclick={() => { selectedShiftId = shift.id; }}>
						{shift.name}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<div class="tl-scroll" bind:this={scrollEl}>
		{#if showNow}
			<div class="tl-now" style="left: {nowLeft}px;"></div>
		{/if}

		<!-- Header row -->
		<div class="tl-row tl-header" style="width: {totalW}px;">
			<div class="tl-info tl-corner"><span class="tl-corner-label">Tbl</span><span class="tl-corner-label">Max</span></div>
			{#each slots as slot (slot.time)}
				<div class="tl-hcell" class:outside={slot.minutes < shiftStartMin || slot.minutes >= shiftEndMin}>
					{#if slot.minutes % 30 === 0}<span class="tl-time">{slot.time}</span>{/if}
				</div>
			{/each}
		</div>

		<!-- Area groups -->
		{#each areaGroups as group (group.area)}
			<!-- Area header -->
			<div class="tl-row tl-area-row" style="width: {totalW}px;">
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="tl-info tl-area-info" onclick={() => toggleArea(group.area)}>
					{#if collapsedAreas.has(group.area)}<ChevronRight size={13} />{:else}<ChevronDown size={13} />{/if}
					<span>{group.area}</span>
				</div>
			</div>

			{#if !collapsedAreas.has(group.area)}
				{#each group.tables as table (table.dbId)}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="tl-row tl-table-row" style="width: {totalW}px;" onclick={(e) => handleRowClick(e, table.id)}>
						<div class="tl-info tl-table-info">
							<span class="tl-tnum">{table.id}</span>
							<span class="tl-tseats">{table.seats}</span>
						</div>
						<!-- grid lines -->
						{#each slots as slot, i (slot.time)}
							<div class="tl-cell" class:major={slot.minutes % 60 === 0} class:outside={slot.minutes < shiftStartMin || slot.minutes >= shiftEndMin} style="left: {INFO_W + i * SLOT_W}px;"></div>
						{/each}
						<!-- blocks -->
						{#each blocksFor(table.id) as b (b.reservation.id)}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="tl-block st-{b.reservation.status}"
								class:tl-dragging={drag?.dragging && drag.reservation.id === b.reservation.id}
								style="left: {b.left}px; width: {b.width}px;"
								onmousedown={(e) => onBlockMouseDown(e, b)}
								title="{b.reservation.guest} · {b.reservation.party}"
							>
								<span class="tl-bicon">{statusIcon(b.reservation.status)}</span>
								<span class="tl-bname">{b.reservation.guest}</span>
								<span class="tl-bparty">{b.reservation.party}</span>
							</div>
						{/each}
					</div>
				{/each}
			{/if}
		{/each}

		<!-- Unassigned -->
		{#if unassigned.length > 0}
			<div class="tl-row tl-area-row" style="width: {totalW}px;">
				<div class="tl-info tl-area-info"><span>Unassigned</span></div>
			</div>
			<div class="tl-row tl-table-row" style="width: {totalW}px;">
				<div class="tl-info tl-table-info"><span class="tl-tnum" style="color: var(--fr-text-subtle)">--</span></div>
				{#each slots as slot, i (slot.time)}
					<div class="tl-cell" class:major={slot.minutes % 60 === 0} class:outside={slot.minutes < shiftStartMin || slot.minutes >= shiftEndMin} style="left: {INFO_W + i * SLOT_W}px;"></div>
				{/each}
				{#each unassignedBlocks() as b (b.reservation.id)}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="tl-block st-{b.reservation.status}"
						class:tl-dragging={drag?.dragging && drag.reservation.id === b.reservation.id}
						style="left: {b.left}px; width: {b.width}px;"
						onmousedown={(e) => onBlockMouseDown(e, b)}
					>
						<span class="tl-bicon">{statusIcon(b.reservation.status)}</span>
						<span class="tl-bname">{b.reservation.guest}</span>
						<span class="tl-bparty">{b.reservation.party}</span>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Summary -->
		<div class="tl-row tl-summary-row" style="width: {totalW}px;">
			<div class="tl-info tl-summary-info"><span>Total</span></div>
			{#each slotSummary as s, i (i)}
				<div class="tl-scell" style="left: {INFO_W + i * SLOT_W}px; {s.covers > maxCovers * 0.75 ? 'background: color-mix(in oklch, var(--fr-accent) 8%, transparent)' : ''}">
					<span class="tl-sp">{s.parties}</span>
					<span class="tl-sc">{s.covers}c</span>
				</div>
			{/each}
		</div>
	</div>
</div>

<!-- Drag ghost -->
{#if drag?.dragging}
	<div
		class="tl-ghost"
		style="left: {drag.currentLeft}px; top: {drag.currentTop}px; width: {drag.width}px;"
	>
		<span class="tl-bicon">{statusIcon(drag.reservation.status)}</span>
		<span class="tl-bname">{drag.reservation.guest}</span>
		<span class="tl-bparty">{drag.reservation.party}</span>
	</div>
{/if}

<!-- Confirmation modal -->
{#if confirmMove}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="tl-modal-overlay" onclick={cancelMove}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="tl-modal" onclick={(e) => e.stopPropagation()}>
			<div style="font-weight: 600; font-size: 16px; margin-bottom: 16px">Move reservation?</div>
			<div style="font-size: 13px; line-height: 1.6; color: var(--fr-text-muted)">
				<div style="font-weight: 500; color: var(--fr-text); margin-bottom: 8px">{confirmMove.reservation.guest} — Party of {confirmMove.reservation.party}</div>
				{#if confirmMove.oldTime !== confirmMove.newTime}
					<div>Time: <strong>{confirmMove.oldTime}</strong> → <strong>{confirmMove.newTime}</strong></div>
				{/if}
				{#if confirmMove.oldTable !== confirmMove.newTable}
					<div>Table: <strong>{confirmMove.oldTable || 'Unassigned'}</strong> → <strong>{confirmMove.newTable}</strong></div>
				{/if}
			</div>
			<div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px">
				<button class="fr-btn" onclick={cancelMove} disabled={saving}>Cancel</button>
				<button class="fr-btn fr-btn-primary" onclick={confirmMoveReservation} disabled={saving}>
					{saving ? 'Saving...' : 'Confirm move'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.tl-wrap { display: flex; flex-direction: column; overflow: hidden; }
	.tl-shift-bar { padding: 10px 16px; border-bottom: 1px solid var(--fr-border); }

	.tl-scroll {
		overflow: auto;
		position: relative;
		flex: 1;
	}

	/* ── Rows ──────────────────────────────────────── */
	.tl-row { display: flex; position: relative; }

	.tl-header {
		position: sticky;
		top: 0;
		z-index: 4;
		height: 36px;
		border-bottom: 1px solid var(--fr-border);
		background: var(--fr-surface);
	}

	.tl-area-row {
		height: 28px;
		background: var(--fr-surface-muted);
		border-bottom: 1px solid var(--fr-border);
	}

	.tl-table-row {
		height: 40px;
		border-bottom: 1px solid var(--fr-border);
		cursor: pointer;
	}

	.tl-table-row:hover { background: color-mix(in oklch, var(--fr-accent) 3%, transparent); }

	.tl-summary-row {
		height: 36px;
		position: sticky;
		bottom: 0;
		background: var(--fr-surface-muted);
		border-top: 1px solid var(--fr-border-strong);
		z-index: 4;
	}

	/* ── Sticky info cells (left column) ───────────── */
	.tl-info {
		width: 120px;
		min-width: 120px;
		flex-shrink: 0;
		position: sticky;
		left: 0;
		z-index: 3;
		background: var(--fr-surface);
		border-right: 1px solid var(--fr-border);
		display: flex;
		align-items: center;
		padding: 0 12px;
	}

	.tl-corner {
		justify-content: space-between;
		background: var(--fr-surface);
		z-index: 5;
	}

	.tl-corner-label {
		font-size: 10.5px;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--fr-text-subtle);
	}

	.tl-area-info {
		background: var(--fr-surface-muted);
		gap: 6px;
		cursor: pointer;
		color: var(--fr-text-muted);
		font-size: 11.5px;
		font-weight: 600;
		user-select: none;
	}

	.tl-area-info:hover { color: var(--fr-text); }

	.tl-table-info {
		justify-content: space-between;
	}

	.tl-tnum {
		font-size: 13px;
		font-weight: 600;
		font-family: var(--fr-font-mono);
	}

	.tl-tseats {
		font-size: 11px;
		color: var(--fr-text-subtle);
		font-variant-numeric: tabular-nums;
	}

	.tl-summary-info {
		background: var(--fr-surface-muted);
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--fr-text-subtle);
	}

	/* ── Time header cells ─────────────────────────── */
	.tl-hcell {
		width: 56px;
		min-width: 56px;
		flex-shrink: 0;
		height: 100%;
		border-right: 1px solid var(--fr-border);
		position: relative;
		display: flex;
		align-items: center;
		padding: 0 4px;
	}

	.tl-hcell.outside { background: color-mix(in oklch, var(--fr-text) 3%, transparent); }

	.tl-time {
		font-size: 10.5px;
		font-weight: 500;
		color: var(--fr-text-muted);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	/* ── Grid cells (vertical lines) ───────────────── */
	.tl-cell {
		position: absolute;
		top: 0;
		width: 56px;
		height: 100%;
		border-right: 1px solid var(--fr-border);
		pointer-events: none;
	}

	.tl-cell.major { border-right-color: var(--fr-border-strong); }
	.tl-cell.outside { background: color-mix(in oklch, var(--fr-text) 3%, transparent); }

	/* ── Now line ──────────────────────────────────── */
	.tl-now {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 2px;
		background: var(--fr-accent);
		z-index: 6;
		pointer-events: none;
	}

	.tl-now::before {
		content: '';
		position: absolute;
		top: -4px;
		left: -3px;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--fr-accent);
	}

	/* ── Reservation blocks ────────────────────────── */
	.tl-block {
		position: absolute;
		top: 3px;
		height: 34px;
		border-radius: var(--fr-radius-sm, 4px);
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 0 6px;
		font-size: 12px;
		overflow: hidden;
		cursor: pointer;
		z-index: 1;
		transition: filter 0.1s;
	}

	.tl-block:hover { filter: brightness(0.93); z-index: 2; }

	.st-confirmed { background: color-mix(in oklch, var(--fr-text-muted) 15%, var(--fr-surface)); border-left: 3px solid var(--fr-text-muted); }
	.st-seated    { background: color-mix(in oklch, #22c55e 15%, var(--fr-surface)); border-left: 3px solid #22c55e; }
	.st-completed { background: var(--fr-surface-muted); opacity: 0.5; border-left: 3px solid var(--fr-border-strong); }
	.st-no-show   { background: color-mix(in oklch, #ef4444 10%, var(--fr-surface)); border-left: 3px solid #ef4444; }

	.tl-bicon { flex-shrink: 0; width: 12px; text-align: center; font-size: 10px; }
	.st-confirmed .tl-bicon { color: var(--fr-text-muted); }
	.st-seated .tl-bicon    { color: #22c55e; }
	.st-completed .tl-bicon { color: var(--fr-border-strong); }
	.st-no-show .tl-bicon   { color: #ef4444; }

	.tl-bname { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; color: var(--fr-text); }
	.tl-bparty { flex-shrink: 0; font-size: 11px; font-variant-numeric: tabular-nums; color: var(--fr-text-muted); font-weight: 500; }

	/* ── Summary cells ─────────────────────────────── */
	.tl-scell {
		position: absolute;
		top: 0;
		width: 56px;
		height: 36px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1px;
		border-right: 1px solid var(--fr-border);
	}

	.tl-sp { font-size: 11px; font-weight: 600; color: var(--fr-text); font-variant-numeric: tabular-nums; line-height: 1; }
	.tl-sc { font-size: 9.5px; color: var(--fr-text-subtle); font-variant-numeric: tabular-nums; line-height: 1; }

	/* ── Drag and drop ─────────────────────────────── */
	.tl-dragging { opacity: 0.3; }

	.tl-ghost {
		position: fixed;
		height: 34px;
		border-radius: var(--fr-radius-sm, 4px);
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 0 6px;
		font-size: 12px;
		overflow: hidden;
		pointer-events: none;
		z-index: 9999;
		background: var(--fr-surface);
		border: 1px solid var(--fr-accent);
		box-shadow: var(--fr-shadow-lg);
		opacity: 0.9;
	}

	/* ── Confirmation modal ────────────────────────── */
	.tl-modal-overlay {
		position: fixed;
		inset: 0;
		z-index: 10000;
		background: rgba(0, 0, 0, 0.4);
		display: grid;
		place-items: center;
	}

	.tl-modal {
		background: var(--fr-surface);
		border: 1px solid var(--fr-border);
		border-radius: 12px;
		padding: 24px;
		width: 400px;
		max-width: 90vw;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
	}
</style>
