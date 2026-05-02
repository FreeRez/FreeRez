<script lang="ts">
	import { Plus, Settings2 } from 'lucide-svelte';
	import type { NormalizedShift } from '$lib/server/dashboard/normalize';

	let { data } = $props();
	const shifts: NormalizedShift[] = $derived(data.shifts);

	let viewMode = $state<'Day' | 'Week' | 'Month'>('Week');
	let showAddShift = $state(false);
	let showOverrides = $state(false);
	let overrideDate = $state('');
	let overrideClosed = $state(false);
	let overrideNote = $state('');
	let newShiftName = $state('');
	let newShiftDay = $state('1');
	let newShiftStart = $state('17:00');
	let newShiftEnd = $state('22:00');
	let newShiftInterval = $state('15');
	let newShiftMax = $state('60');

	const weekStart = new Date(2026, 3, 27); // Mon Apr 27 2026
	const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

	const weekDates = $derived(
		dayNames.map((name, i) => {
			const d = new Date(weekStart);
			d.setDate(d.getDate() + i);
			return { name, date: d.getDate(), full: d };
		})
	);

	const hours = Array.from({ length: 16 }, (_, i) => i + 9); // 09:00 to 24:00

	const colorMap: Record<string, string> = {
		lunch: 'var(--fr-info)',
		dinner: 'var(--fr-accent)',
		brunch: 'var(--fr-warn)'
	};

	function parseTime(t: string): { h: number; m: number } {
		const [h, m] = t.split(':').map(Number);
		return { h, m };
	}

	function shiftBlockStyle(start: string, end: string, color: string) {
		const s = parseTime(start);
		const e = parseTime(end);
		const topPx = (s.h - 9 + s.m / 60) * 36;
		const durationHrs = (e.h + e.m / 60) - (s.h + s.m / 60);
		const heightPx = durationHrs * 36;
		const c = colorMap[color] || 'var(--fr-accent)';
		return `top: ${topPx}px; height: ${heightPx}px; background: color-mix(in srgb, ${c} 18%, transparent); border-left: 3px solid ${c}; border-radius: 4px;`;
	}

	function shiftsForDay(dayName: string) {
		return shifts.filter(s => s.day === dayName);
	}

	function formatTimeRange(start: string, end: string) {
		return `${start} - ${end}`;
	}
</script>

<div class="fr-content">
	<div class="fr-page-head">
		<div>
			<h1 class="fr-page-title">Availability</h1>
			<p class="fr-page-sub">Week of Apr 27 - May 3, 2026 · {shifts.length} shifts configured</p>
		</div>
		<div class="fr-row" style="gap: 8px">
			<div class="fr-segment">
				{#each ['Day', 'Week', 'Month'] as mode (mode)}
					<button
						class:active={viewMode === mode}
						onclick={() => viewMode = mode as 'Day' | 'Week' | 'Month'}
					>
						{mode}
					</button>
				{/each}
			</div>
			<button class="fr-btn" onclick={() => showOverrides = true}><Settings2 size={14} /> Date overrides</button>
			<button class="fr-btn fr-btn-primary" onclick={() => showAddShift = true}><Plus size={14} /> Add shift</button>
		</div>
	</div>

	<div class="fr-card" style="overflow: auto">
		<div style="display: grid; grid-template-columns: 60px repeat(7, 1fr); min-width: 700px">
			<!-- Header row -->
			<div style="padding: 12px 8px; border-bottom: 1px solid var(--fr-border); border-right: 1px solid var(--fr-border)"></div>
			{#each weekDates as day (day.name)}
				<div style="padding: 12px 8px; text-align: center; border-bottom: 1px solid var(--fr-border); border-right: 1px solid var(--fr-border)">
					<div class="fr-subtle" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px">{day.name}</div>
					<div style="font-size: 18px; font-weight: 600; margin-top: 2px">{day.date}</div>
				</div>
			{/each}

			<!-- Hour grid -->
			{#each hours as hour (hour)}
				<!-- Hour label -->
				<div style="height: 36px; padding: 0 8px; display: flex; align-items: flex-start; justify-content: flex-end; border-right: 1px solid var(--fr-border)">
					<span class="fr-mono fr-subtle" style="font-size: 10.5px; transform: translateY(-6px)">{hour.toString().padStart(2, '0')}:00</span>
				</div>
				<!-- Day columns -->
				{#each dayNames as dayName (dayName)}
					<div style="height: 36px; border-bottom: 1px solid var(--fr-border); border-right: 1px solid var(--fr-border)"></div>
				{/each}
			{/each}
		</div>

		<!-- Shift blocks overlay -->
		<div style="position: relative; margin-top: -{hours.length * 36}px; margin-left: 60px; display: grid; grid-template-columns: repeat(7, 1fr); pointer-events: none">
			{#each dayNames as dayName (dayName)}
				<div style="position: relative; height: {hours.length * 36}px">
					{#each shiftsForDay(dayName) as shift (shift.id)}
						<div
							style="position: absolute; left: 4px; right: 4px; padding: 6px 8px; overflow: hidden; pointer-events: auto; cursor: pointer; {shiftBlockStyle(shift.start, shift.end, shift.color)}"
						>
							<div style="font-size: 11.5px; font-weight: 600; line-height: 1.2">{shift.name}</div>
							<div class="fr-subtle" style="font-size: 10.5px; margin-top: 2px">{formatTimeRange(shift.start, shift.end)}</div>
							<div class="fr-subtle" style="font-size: 10px; margin-top: 1px">{shift.max} covers · {shift.interval}min</div>
						</div>
					{/each}
				</div>
			{/each}
		</div>
	</div>
</div>

{#if showOverrides}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fr-modal-overlay" onclick={() => showOverrides = false}>
		<div class="fr-modal" style="width: 440px" onclick={(e) => e.stopPropagation()}>
			<div style="padding: 20px 24px; border-bottom: 1px solid var(--fr-border)">
				<h2 style="margin: 0; font-size: 18px; font-weight: 600">Date override</h2>
				<p class="fr-subtle" style="margin: 4px 0 0; font-size: 13px">Override availability for a specific date</p>
			</div>
			<div style="padding: 24px; display: flex; flex-direction: column; gap: 16px">
				<div><label class="fr-label" for="override-date">Date</label><input class="fr-input" id="override-date" type="date" bind:value={overrideDate} /></div>
				<label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer">
					<input type="checkbox" bind:checked={overrideClosed} /> Closed for the day
				</label>
				<div><label class="fr-label" for="override-note">Note</label><input class="fr-input" id="override-note" bind:value={overrideNote} placeholder="Holiday, private event, etc." /></div>
			</div>
			<div style="padding: 16px 24px; border-top: 1px solid var(--fr-border); display: flex; justify-content: flex-end; gap: 8px">
				<button class="fr-btn" onclick={() => showOverrides = false}>Cancel</button>
				<button class="fr-btn fr-btn-primary" onclick={() => { showOverrides = false; }}>Save override</button>
			</div>
		</div>
	</div>
{/if}

{#if showAddShift}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fr-modal-overlay" onclick={() => showAddShift = false}>
		<div class="fr-modal" style="width: 480px" onclick={(e) => e.stopPropagation()}>
			<div style="padding: 20px 24px; border-bottom: 1px solid var(--fr-border)">
				<h2 style="margin: 0; font-size: 18px; font-weight: 600">Add shift</h2>
			</div>
			<div style="padding: 24px; display: flex; flex-direction: column; gap: 16px">
				<div>
					<label class="fr-label" for="shift-name">Name</label>
					<input class="fr-input" id="shift-name" bind:value={newShiftName} placeholder="Dinner" />
				</div>
				<div>
					<label class="fr-label" for="shift-day">Day of week</label>
					<select class="fr-select" id="shift-day" bind:value={newShiftDay}>
						<option value="0">Sunday</option>
						<option value="1">Monday</option>
						<option value="2">Tuesday</option>
						<option value="3">Wednesday</option>
						<option value="4">Thursday</option>
						<option value="5">Friday</option>
						<option value="6">Saturday</option>
					</select>
				</div>
				<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px">
					<div>
						<label class="fr-label" for="shift-start">Start time</label>
						<input class="fr-input" id="shift-start" type="time" bind:value={newShiftStart} />
					</div>
					<div>
						<label class="fr-label" for="shift-end">End time</label>
						<input class="fr-input" id="shift-end" type="time" bind:value={newShiftEnd} />
					</div>
				</div>
				<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px">
					<div>
						<label class="fr-label" for="shift-interval">Interval (min)</label>
						<input class="fr-input" id="shift-interval" type="number" bind:value={newShiftInterval} />
					</div>
					<div>
						<label class="fr-label" for="shift-max">Max covers</label>
						<input class="fr-input" id="shift-max" type="number" bind:value={newShiftMax} />
					</div>
				</div>
			</div>
			<div style="padding: 16px 24px; border-top: 1px solid var(--fr-border); display: flex; justify-content: flex-end; gap: 8px">
				<button class="fr-btn" onclick={() => showAddShift = false}>Cancel</button>
				<button class="fr-btn fr-btn-primary" onclick={async () => {
					const fd = new FormData();
					fd.set('name', newShiftName);
					fd.set('dayOfWeek', newShiftDay);
					fd.set('startTime', newShiftStart);
					fd.set('endTime', newShiftEnd);
					fd.set('interval', newShiftInterval);
					fd.set('maxCovers', newShiftMax);
					await fetch('/dashboard/availability?/createShift', { method: 'POST', body: fd });
					const { invalidateAll } = await import('$app/navigation');
					await invalidateAll();
					showAddShift = false;
					newShiftName = '';
					newShiftDay = '1';
					newShiftStart = '17:00';
					newShiftEnd = '22:00';
					newShiftInterval = '15';
					newShiftMax = '60';
				}}>Create shift</button>
			</div>
		</div>
	</div>
{/if}
