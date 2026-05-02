<script lang="ts">
	import { Plus, SquarePen, Eye } from 'lucide-svelte';
	import type { NormalizedExperience } from '$lib/server/dashboard/normalize';

	let { data } = $props();
	const experiences: NormalizedExperience[] = $derived(data.experiences);

	let showCreateExp = $state(false);
	let newExpName = $state('');
	let newExpDesc = $state('');
	let newExpPrice = $state('');
	let newExpPrepaid = $state(false);

	let editExp = $state<NormalizedExperience | null>(null);
	let editExpName = $state('');
	let editExpDesc = $state('');
	let editExpPrice = $state('');
	let editExpPrepaid = $state(false);

	let previewExp = $state<NormalizedExperience | null>(null);

	function formatPrice(from: number, to: number): string {
		if (from === to) return `$${from}`;
		return `$${from} – $${to}`;
	}
</script>

<div class="fr-content">
	<div class="fr-page-head">
		<div>
			<h1 class="fr-page-title">Experiences</h1>
			<p class="fr-page-sub">{experiences.length} experiences · {experiences.filter(e => e.active).length} active</p>
		</div>
		<div class="fr-row" style="gap: 8px">
			<button class="fr-btn fr-btn-primary" onclick={() => showCreateExp = true}><Plus size={14} /> Create experience</button>
		</div>
	</div>

	<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px">
		{#each experiences as exp (exp.id)}
			<div class="fr-card">
				<div class="fr-card-pad" style="padding-bottom: 0">
					<div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px">
						<div style="flex: 1; min-width: 0">
							<div style="font-size: 17px; font-weight: 600; line-height: 1.3">{exp.name}</div>
							<div class="fr-subtle" style="margin-top: 4px; font-size: 13px; line-height: 1.5">{exp.desc}</div>
						</div>
						<span class="fr-badge {exp.active ? 'confirmed' : 'cancelled'}">{exp.active ? 'Active' : 'Draft'}</span>
					</div>
				</div>

				<div style="display: grid; grid-template-columns: repeat(3, 1fr); margin: 16px 20px 0; border: 1px solid var(--fr-border); border-radius: 8px; overflow: hidden">
					<div style="padding: 12px 14px; text-align: center">
						<div class="fr-subtle" style="font-size: 11px; margin-bottom: 4px">Price</div>
						<div class="fr-num" style="font-weight: 600; font-size: 14px">{formatPrice(exp.priceFrom, exp.priceTo)}</div>
					</div>
					<div style="padding: 12px 14px; text-align: center; border-left: 1px solid var(--fr-border); border-right: 1px solid var(--fr-border)">
						<div class="fr-subtle" style="font-size: 11px; margin-bottom: 4px">30-day bookings</div>
						<div class="fr-num" style="font-weight: 600; font-size: 14px">{exp.bookings30}</div>
					</div>
					<div style="padding: 12px 14px; text-align: center">
						<div class="fr-subtle" style="font-size: 11px; margin-bottom: 4px">Type</div>
						<div style="font-weight: 500; font-size: 13px">{exp.prepaid ? 'Prepaid' : 'On-site'}</div>
					</div>
				</div>

				<div class="fr-card-pad" style="display: flex; gap: 8px; padding-top: 16px">
					<button class="fr-btn fr-btn-sm" onclick={() => { editExp = exp; editExpName = exp.name; editExpDesc = exp.desc; editExpPrice = String(exp.priceFrom); editExpPrepaid = exp.prepaid; }}><SquarePen size={13} /> Edit</button>
					<button class="fr-btn fr-btn-sm fr-btn-ghost" onclick={() => previewExp = exp}><Eye size={13} /> Preview</button>
				</div>
			</div>
		{/each}
	</div>
</div>

{#if showCreateExp}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fr-modal-overlay" onclick={() => showCreateExp = false}>
		<div class="fr-modal" style="width: 480px" onclick={(e) => e.stopPropagation()}>
			<div style="padding: 20px 24px; border-bottom: 1px solid var(--fr-border)">
				<h2 style="margin: 0; font-size: 18px; font-weight: 600">Create experience</h2>
			</div>
			<div style="padding: 24px; display: flex; flex-direction: column; gap: 16px">
				<div>
					<label class="fr-label" for="exp-name">Name</label>
					<input class="fr-input" id="exp-name" bind:value={newExpName} placeholder="Chef's Tasting Menu" />
				</div>
				<div>
					<label class="fr-label" for="exp-desc">Description</label>
					<textarea class="fr-textarea" id="exp-desc" rows="3" bind:value={newExpDesc} placeholder="Describe this experience..."></textarea>
				</div>
				<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px">
					<div>
						<label class="fr-label" for="exp-price">Price ($)</label>
						<input class="fr-input" id="exp-price" type="number" step="0.01" min="0" bind:value={newExpPrice} placeholder="150.00" />
					</div>
					<div style="display: flex; align-items: end; padding-bottom: 4px">
						<label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer">
							<input type="checkbox" bind:checked={newExpPrepaid} />
							Prepaid
						</label>
					</div>
				</div>
			</div>
			<div style="padding: 16px 24px; border-top: 1px solid var(--fr-border); display: flex; justify-content: flex-end; gap: 8px">
				<button class="fr-btn" onclick={() => showCreateExp = false}>Cancel</button>
				<button class="fr-btn fr-btn-primary" onclick={async () => {
					const fd = new FormData();
					fd.set('name', newExpName);
					fd.set('description', newExpDesc);
					fd.set('priceCents', String(Math.round(parseFloat(newExpPrice || '0') * 100)));
					fd.set('prepaid', newExpPrepaid ? 'true' : 'false');
					await fetch('/dashboard/experiences?/createExperience', { method: 'POST', body: fd });
					const { invalidateAll } = await import('$app/navigation');
					await invalidateAll();
					showCreateExp = false;
					newExpName = '';
					newExpDesc = '';
					newExpPrice = '';
					newExpPrepaid = false;
				}}>Create experience</button>
			</div>
		</div>
	</div>
{/if}

{#if editExp}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fr-modal-overlay" onclick={() => editExp = null}>
		<div class="fr-modal" style="width: 480px" onclick={(e) => e.stopPropagation()}>
			<div style="padding: 20px 24px; border-bottom: 1px solid var(--fr-border)">
				<h2 style="margin: 0; font-size: 18px; font-weight: 600">Edit experience</h2>
			</div>
			<div style="padding: 24px; display: flex; flex-direction: column; gap: 16px">
				<div>
					<label class="fr-label" for="edit-exp-name">Name</label>
					<input class="fr-input" id="edit-exp-name" bind:value={editExpName} />
				</div>
				<div>
					<label class="fr-label" for="edit-exp-desc">Description</label>
					<textarea class="fr-textarea" id="edit-exp-desc" rows="3" bind:value={editExpDesc}></textarea>
				</div>
				<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px">
					<div>
						<label class="fr-label" for="edit-exp-price">Price ($)</label>
						<input class="fr-input" id="edit-exp-price" type="number" step="0.01" min="0" bind:value={editExpPrice} />
					</div>
					<div style="display: flex; align-items: end; padding-bottom: 4px">
						<label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer">
							<input type="checkbox" bind:checked={editExpPrepaid} />
							Prepaid
						</label>
					</div>
				</div>
			</div>
			<div style="padding: 16px 24px; border-top: 1px solid var(--fr-border); display: flex; justify-content: flex-end; gap: 8px">
				<button class="fr-btn" onclick={() => editExp = null}>Cancel</button>
				<button class="fr-btn fr-btn-primary" onclick={async () => {
					if (!editExp) return;
					const fd = new FormData();
					fd.set('experienceId', editExp.id);
					fd.set('name', editExpName);
					fd.set('description', editExpDesc);
					fd.set('price', String(Math.round(parseFloat(editExpPrice || '0') * 100)));
					fd.set('prepaid', editExpPrepaid ? 'true' : 'false');
					await fetch('/dashboard/experiences?/updateExperience', { method: 'POST', body: fd });
					const { invalidateAll } = await import('$app/navigation');
					await invalidateAll();
					editExp = null;
				}}>Save changes</button>
			</div>
		</div>
	</div>
{/if}

{#if previewExp}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fr-modal-overlay" onclick={() => previewExp = null}>
		<div class="fr-modal" style="width: 480px" onclick={(e) => e.stopPropagation()}>
			<div style="padding: 24px">
				<h2 style="font-size: 22px; font-weight: 600; margin: 0 0 8px">{previewExp.name}</h2>
				<p style="color: var(--fr-text-muted); font-size: 14px; line-height: 1.6; margin: 0 0 20px">{previewExp.desc}</p>
				<div style="padding: 16px; background: var(--fr-surface-muted); border-radius: var(--fr-radius); display: flex; justify-content: space-between; align-items: center">
					<div>
						<div class="fr-stat-label">Price</div>
						<div style="font-size: 24px; font-weight: 600; margin-top: 4px">{previewExp.priceFrom === previewExp.priceTo ? `$${previewExp.priceFrom}` : `$${previewExp.priceFrom} – $${previewExp.priceTo}`}</div>
					</div>
					<div style="text-align: right">
						<div class="fr-stat-label">Type</div>
						<div style="font-size: 14px; font-weight: 500; margin-top: 4px">{previewExp.prepaid ? 'Prepaid' : 'Pay on-site'}</div>
					</div>
				</div>
			</div>
			<div style="padding: 16px 24px; border-top: 1px solid var(--fr-border); text-align: right">
				<button class="fr-btn" onclick={() => previewExp = null}>Close</button>
			</div>
		</div>
	</div>
{/if}
