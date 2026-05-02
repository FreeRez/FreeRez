<script lang="ts">
	import { Plus, Ellipsis, Check, X } from 'lucide-svelte';
	import type { NormalizedTable } from '$lib/server/dashboard/normalize';

	let { data } = $props();
	const tables: NormalizedTable[] = $derived(data.tables);

	const areas = ['Main', 'Bar', 'Garden', 'Private'] as const;

	let activeArea = $state<string>('Main');

	const areaCounts = $derived(
		Object.fromEntries(areas.map(a => [a, tables.filter(t => t.area === a).length]))
	);

	const filteredTables = $derived(tables.filter(t => t.area === activeArea));

	const totalCount = $derived(tables.length);
	const areaCount = areas.length;

	// Area settings mock data
	const areaSettings: Record<string, { name: string; desc: string; env: 'Indoor' | 'Outdoor'; attrs: string[] }> = {
		Main: { name: 'Main', desc: 'Primary dining room with banquettes and window seating.', env: 'Indoor', attrs: ['Air conditioned', 'Wheelchair accessible'] },
		Bar: { name: 'Bar', desc: 'High-top bar seating with cocktail service.', env: 'Indoor', attrs: ['Counter seating', 'TV screens'] },
		Garden: { name: 'Garden', desc: 'Seasonal outdoor terrace with heaters.', env: 'Outdoor', attrs: ['Heated', 'Covered', 'Pet friendly'] },
		Private: { name: 'Private', desc: 'Private dining rooms for events and groups.', env: 'Indoor', attrs: ['AV equipped', 'Sound insulated', 'Dedicated server'] }
	};

	const currentSettings = $derived(areaSettings[activeArea]);

	let showAddTable = $state(false);
	let newTableNumber = $state('');
	let newTableMin = $state('2');
	let newTableMax = $state('4');
	let newTableShape = $state('square');

	let showAddArea = $state(false);
	let newAreaName = $state('');
	let newAreaDesc = $state('');
	let newAreaEnv = $state('Indoor');

	let actionTableId = $state<string | null>(null);
	let addingAttr = $state(false);
	let newAttrName = $state('');

	function minSeats(t: NormalizedTable) {
		if (t.shape === 'round' && t.seats <= 2) return 1;
		return Math.max(1, Math.floor(t.seats / 2));
	}
</script>

<div class="fr-content">
	<div class="fr-page-head">
		<div>
			<h1 class="fr-page-title">Tables & areas</h1>
			<p class="fr-page-sub">{totalCount} tables across {areaCount} areas</p>
		</div>
		<div class="fr-row" style="gap: 8px">
			<button class="fr-btn" onclick={() => showAddArea = true}><Plus size={14} /> Add area</button>
			<button class="fr-btn fr-btn-primary" onclick={() => showAddTable = true}><Plus size={14} /> Add table</button>
		</div>
	</div>

	<!-- Area tabs -->
	<div class="fr-tabs" style="margin-bottom: 16px">
		{#each areas as area (area)}
			<button
				class="fr-tab"
				class:active={activeArea === area}
				onclick={() => activeArea = area}
			>
				{area}
				<span class="fr-subtle" style="margin-left: 4px; font-size: 12px">({areaCounts[area]})</span>
			</button>
		{/each}
	</div>

	<!-- Grid: table list + settings sidebar -->
	<div style="display: grid; grid-template-columns: 1fr 320px; gap: 16px; align-items: start">
		<!-- Table listing -->
		<div class="fr-card">
			<table class="fr-table">
				<thead>
					<tr>
						<th style="width: 80px">Table</th>
						<th style="width: 90px">Shape</th>
						<th style="width: 50px">Min</th>
						<th style="width: 50px">Max</th>
						<th style="width: 100px">Position</th>
						<th style="width: 100px">Status</th>
						<th style="width: 80px">Active</th>
						<th style="width: 40px"></th>
					</tr>
				</thead>
				<tbody>
					{#each filteredTables as t (t.id)}
						<tr>
							<td>
								<span class="fr-mono" style="font-weight: 600">{t.id}</span>
							</td>
							<td>
								<span class="fr-muted" style="text-transform: capitalize">{t.shape}</span>
							</td>
							<td>
								<span class="fr-num">{minSeats(t)}</span>
							</td>
							<td>
								<span class="fr-num">{t.seats}</span>
							</td>
							<td>
								<span class="fr-mono fr-subtle" style="font-size: 12px">{t.x}, {t.y}</span>
							</td>
							<td>
								<span class="fr-badge {t.status}">{t.status}</span>
							</td>
							<td>
								{#if t.status !== 'blocked'}
									<span class="fr-badge confirmed"><Check size={12} /> Yes</span>
								{:else}
									<span class="fr-badge" style="opacity: 0.5">No</span>
								{/if}
							</td>
							<td style="text-align: right">
								<div style="position: relative">
									<button class="fr-btn fr-btn-ghost fr-btn-icon" style="width: 28px; height: 28px" onclick={() => actionTableId = actionTableId === t.dbId ? null : t.dbId}>
										<Ellipsis size={14} />
									</button>
									{#if actionTableId === t.dbId}
										<!-- svelte-ignore a11y_click_events_have_key_events -->
										<!-- svelte-ignore a11y_no_static_element_interactions -->
										<div style="position: fixed; inset: 0; z-index: 49" onclick={() => actionTableId = null}></div>
										<div style="position: absolute; right: 0; top: 32px; width: 140px; background: var(--fr-surface); border: 1px solid var(--fr-border); border-radius: var(--fr-radius); box-shadow: var(--fr-shadow-md); z-index: 50; overflow: hidden">
											<button style="width: 100%; padding: 8px 12px; border: 0; background: transparent; text-align: left; font-size: 13px; cursor: pointer; font-family: inherit; color: var(--fr-danger)" onclick={async () => {
												if (!confirm('Delete this table?')) return;
												const fd = new FormData();
												fd.set('tableId', t.dbId);
												await fetch('/dashboard/tables?/deleteTable', { method: 'POST', body: fd });
												const { invalidateAll } = await import('$app/navigation');
												await invalidateAll();
												actionTableId = null;
											}}>Delete table</button>
										</div>
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>

			{#if filteredTables.length === 0}
				<div style="padding: 48px 20px; text-align: center; color: var(--fr-text-muted); font-size: 14px">
					No tables in this area.
				</div>
			{/if}
		</div>

		<!-- Area settings sidebar -->
		<div class="fr-card fr-card-pad">
			<div class="fr-card-head">
				<div>
					<h3 class="fr-card-title">Area settings</h3>
					<p class="fr-card-sub">{activeArea} configuration</p>
				</div>
			</div>

			<div style="display: flex; flex-direction: column; gap: 16px; margin-top: 16px">
				<label class="fr-label" style="display: flex; flex-direction: column; gap: 4px">
					Area name
					<input class="fr-input" type="text" value={currentSettings.name} />
				</label>

				<label class="fr-label" style="display: flex; flex-direction: column; gap: 4px">
					Description
					<textarea class="fr-textarea" rows="3">{currentSettings.desc}</textarea>
				</label>

				<div>
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label class="fr-label">Environment</label>
					<div class="fr-segment" style="margin-top: 4px">
						<button class:active={currentSettings.env === 'Indoor'}>Indoor</button>
						<button class:active={currentSettings.env === 'Outdoor'}>Outdoor</button>
					</div>
				</div>

				<div>
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label class="fr-label">Attributes</label>
					<div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px">
						{#each currentSettings.attrs as attr (attr)}
							<span class="fr-tag">{attr}</span>
						{/each}
						{#if addingAttr}
							<div style="display: flex; gap: 4px; align-items: center">
								<input class="fr-input" style="height: 24px; width: 120px; font-size: 12px; padding: 0 6px" bind:value={newAttrName} placeholder="Attribute..." />
								<button class="fr-btn fr-btn-sm fr-btn-ghost" style="height: 24px; padding: 0 6px" onclick={() => {
									if (newAttrName.trim()) {
										currentSettings.attrs = [...currentSettings.attrs, newAttrName.trim()];
										newAttrName = '';
									}
									addingAttr = false;
								}}><Check size={12} /></button>
								<button class="fr-btn fr-btn-sm fr-btn-ghost" style="height: 24px; padding: 0 6px" onclick={() => { addingAttr = false; newAttrName = ''; }}><X size={12} /></button>
							</div>
						{:else}
							<button class="fr-btn fr-btn-sm fr-btn-ghost" style="font-size: 12px; padding: 2px 8px" onclick={() => addingAttr = true}>
								<Plus size={12} /> Add
							</button>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

{#if showAddTable}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fr-modal-overlay" onclick={() => showAddTable = false}>
		<div class="fr-modal" style="width: 440px" onclick={(e) => e.stopPropagation()}>
			<div style="padding: 20px 24px; border-bottom: 1px solid var(--fr-border)">
				<h2 style="margin: 0; font-size: 18px; font-weight: 600">Add table</h2>
			</div>
			<div style="padding: 24px; display: flex; flex-direction: column; gap: 16px">
				<div>
					<label class="fr-label" for="table-number">Table number</label>
					<input class="fr-input" id="table-number" type="text" bind:value={newTableNumber} placeholder="T12" />
				</div>
				<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px">
					<div>
						<label class="fr-label" for="table-min">Min covers</label>
						<input class="fr-input" id="table-min" type="number" bind:value={newTableMin} />
					</div>
					<div>
						<label class="fr-label" for="table-max">Max covers</label>
						<input class="fr-input" id="table-max" type="number" bind:value={newTableMax} />
					</div>
				</div>
				<div>
					<label class="fr-label" for="table-shape">Shape</label>
					<select class="fr-select" id="table-shape" bind:value={newTableShape}>
						<option value="square">Square</option>
						<option value="round">Round</option>
						<option value="rectangle">Rectangle</option>
					</select>
				</div>
			</div>
			<div style="padding: 16px 24px; border-top: 1px solid var(--fr-border); display: flex; justify-content: flex-end; gap: 8px">
				<button class="fr-btn" onclick={() => showAddTable = false}>Cancel</button>
				<button class="fr-btn fr-btn-primary" onclick={async () => {
					const fd = new FormData();
					fd.set('tableNumber', newTableNumber);
					fd.set('minCovers', newTableMin);
					fd.set('maxCovers', newTableMax);
					fd.set('shape', newTableShape);
					fd.set('area', activeArea);
					await fetch('/dashboard/tables?/createTable', { method: 'POST', body: fd });
					const { invalidateAll } = await import('$app/navigation');
					await invalidateAll();
					showAddTable = false;
					newTableNumber = '';
					newTableMin = '2';
					newTableMax = '4';
					newTableShape = 'square';
				}}>Create table</button>
			</div>
		</div>
	</div>
{/if}

{#if showAddArea}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fr-modal-overlay" onclick={() => showAddArea = false}>
		<div class="fr-modal" style="width: 440px" onclick={(e) => e.stopPropagation()}>
			<div style="padding: 20px 24px; border-bottom: 1px solid var(--fr-border)">
				<h2 style="margin: 0; font-size: 18px; font-weight: 600">Add area</h2>
			</div>
			<div style="padding: 24px; display: flex; flex-direction: column; gap: 16px">
				<div>
					<label class="fr-label" for="area-name">Name</label>
					<input class="fr-input" id="area-name" type="text" bind:value={newAreaName} placeholder="Rooftop" />
				</div>
				<div>
					<label class="fr-label" for="area-desc">Description</label>
					<textarea class="fr-textarea" id="area-desc" rows="3" bind:value={newAreaDesc} placeholder="Describe this dining area..."></textarea>
				</div>
				<div>
					<label class="fr-label" for="area-env">Environment</label>
					<select class="fr-select" id="area-env" bind:value={newAreaEnv}>
						<option value="Indoor">Indoor</option>
						<option value="Outdoor">Outdoor</option>
					</select>
				</div>
			</div>
			<div style="padding: 16px 24px; border-top: 1px solid var(--fr-border); display: flex; justify-content: flex-end; gap: 8px">
				<button class="fr-btn" onclick={() => showAddArea = false}>Cancel</button>
				<button class="fr-btn fr-btn-primary" onclick={async () => {
					const fd = new FormData();
					fd.set('name', newAreaName);
					fd.set('description', newAreaDesc);
					fd.set('environment', newAreaEnv);
					await fetch('/dashboard/tables?/createArea', { method: 'POST', body: fd });
					const { invalidateAll } = await import('$app/navigation');
					await invalidateAll();
					showAddArea = false;
					newAreaName = '';
					newAreaDesc = '';
					newAreaEnv = 'Indoor';
				}}>Create area</button>
			</div>
		</div>
	</div>
{/if}
