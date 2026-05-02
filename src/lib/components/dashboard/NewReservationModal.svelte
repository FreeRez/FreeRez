<script lang="ts">
	import { X, ChevronLeft, ChevronRight } from 'lucide-svelte';
	import { invalidateAll } from '$app/navigation';
	import { untrack } from 'svelte';

	let {
		onclose,
		prefillTable = '',
		prefillTime = '',
	}: {
		onclose: () => void;
		prefillTable?: string;
		prefillTime?: string;
	} = $props();

	let step = $state(untrack(() => prefillTable && prefillTime ? 2 : 1));

	// Step 1 state
	let selectedDate = $state(new Date().toISOString().slice(0, 10));
	let selectedParty = $state(2);
	let selectedTime = $state(untrack(() => prefillTime));
	let selectedArea = $state('Any');

	// Step 2 state
	let firstName = $state('');
	let lastName = $state('');
	let phone = $state('');
	let email = $state('');
	let specialRequest = $state('');
	let sendSms = $state(true);
	let markVip = $state(false);
	let waiveDeposit = $state(false);

	const partySizes = [2, 3, 4, 5, 6, 7, 8];

	const times = [
		'17:00', '17:15', '17:30', '17:45',
		'18:00', '18:15', '18:30', '18:45',
		'19:00', '19:15', '19:30', '19:45',
		'20:00', '20:15', '20:30', '21:00'
	];

	const diningAreas = ['Any', 'Main', 'Bar', 'Garden', 'Private'];

	async function createReservation() {
		const formData = new FormData();
		formData.set('firstName', firstName);
		formData.set('lastName', lastName);
		formData.set('email', email);
		formData.set('phone', phone);
		formData.set('date', selectedDate);
		formData.set('time', selectedTime);
		formData.set('partySize', String(selectedParty));
		formData.set('specialRequest', specialRequest);
		if (prefillTable) formData.set('tableNumber', prefillTable);
		await fetch('/dashboard/reservations?/create', {
			method: 'POST',
			body: formData
		});
		await invalidateAll();
		onclose();
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fr-modal-overlay" onclick={onclose}>
	<div class="fr-modal" onclick={e => e.stopPropagation()} style="width: 560px; max-height: 90vh; display: flex; flex-direction: column">
		<!-- Header -->
		<div style="padding: 20px 24px; border-bottom: 1px solid var(--fr-border); display: flex; align-items: flex-start; justify-content: space-between">
			<div>
				<h2 style="font-weight: 600; font-size: 18px; margin: 0">New reservation</h2>
				<p class="fr-subtle" style="font-size: 13px; margin: 4px 0 0">Step {step} of 2</p>
			</div>
			<button class="fr-btn fr-btn-ghost fr-btn-icon" onclick={onclose}>
				<X size={16} />
			</button>
		</div>

		<!-- Body -->
		<div style="flex: 1; overflow: auto; padding: 24px">
			{#if step === 1}
				{#if prefillTable}
					<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px; padding: 8px 12px; background: var(--fr-surface-muted); border-radius: var(--fr-radius); font-size: 13px">
						<span class="fr-subtle">Table</span>
						<span style="font-weight: 600; font-family: var(--fr-font-mono)">{prefillTable}</span>
					</div>
				{/if}
				<!-- Date & Party size -->
				<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px">
					<div>
						<label class="fr-label" for="nr-date">Date</label>
						<input class="fr-input" id="nr-date" type="date" bind:value={selectedDate} />
					</div>
					<div>
						<!-- svelte-ignore a11y_label_has_associated_control -->
						<label class="fr-label">Party size</label>
						<div style="display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap">
							{#each partySizes as size (size)}
								<button
									class="fr-chip"
									class:active={selectedParty === size}
									onclick={() => selectedParty = size}
								>
									{size}
								</button>
							{/each}
						</div>
					</div>
				</div>

				<!-- Available times -->
				<div style="margin-bottom: 24px">
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label class="fr-label">Available times</label>
					<div style="display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; margin-top: 6px">
						{#each times as time (time)}
							<button
								class="fr-chip"
								class:active={selectedTime === time}
								onclick={() => selectedTime = time}
								style="justify-content: center; font-variant-numeric: tabular-nums"
							>
								{time}
							</button>
						{/each}
					</div>
				</div>

				<!-- Dining area -->
				<div>
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label class="fr-label">Dining area</label>
					<div class="fr-segment" style="margin-top: 6px">
						{#each diningAreas as area (area)}
							<button
								class:active={selectedArea === area}
								onclick={() => selectedArea = area}
							>
								{area}
							</button>
						{/each}
					</div>
				</div>
			{:else}
				<!-- Guest details -->
				<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px">
					<div>
						<label class="fr-label" for="nr-fname">First name</label>
						<input class="fr-input" id="nr-fname" type="text" bind:value={firstName} placeholder="First name" />
					</div>
					<div>
						<label class="fr-label" for="nr-lname">Last name</label>
						<input class="fr-input" id="nr-lname" type="text" bind:value={lastName} placeholder="Last name" />
					</div>
					<div>
						<label class="fr-label" for="nr-phone">Phone</label>
						<input class="fr-input" id="nr-phone" type="tel" bind:value={phone} placeholder="+1 555 000 0000" />
					</div>
					<div>
						<label class="fr-label" for="nr-email">Email</label>
						<input class="fr-input" id="nr-email" type="email" bind:value={email} placeholder="guest@example.com" />
					</div>
				</div>

				<div style="margin-bottom: 20px">
					<label class="fr-label" for="nr-request">Special request</label>
					<textarea class="fr-textarea" id="nr-request" rows="3" bind:value={specialRequest} placeholder="Allergies, celebrations, seating preferences..."></textarea>
				</div>

				<div style="display: flex; flex-direction: column; gap: 12px">
					<label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer">
						<input type="checkbox" bind:checked={sendSms} />
						Send SMS confirmation
					</label>
					<label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer">
						<input type="checkbox" bind:checked={markVip} />
						Mark as VIP
					</label>
					<label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer">
						<input type="checkbox" bind:checked={waiveDeposit} />
						Waive deposit
					</label>
				</div>
			{/if}
		</div>

		<!-- Footer -->
		<div style="padding: 16px 24px; border-top: 1px solid var(--fr-border); display: flex; align-items: center; gap: 8px; justify-content: space-between">
			<button class="fr-btn fr-btn-ghost" onclick={onclose}>Cancel</button>
			<div style="display: flex; gap: 8px">
				{#if step === 2}
					<button class="fr-btn fr-btn-ghost" onclick={() => step = 1}>
						<ChevronLeft size={14} /> Back
					</button>
					<button class="fr-btn fr-btn-primary" onclick={createReservation}>
						Create reservation
					</button>
				{:else}
					<button class="fr-btn fr-btn-primary" onclick={() => step = 2}>
						Continue <ChevronRight size={14} />
					</button>
				{/if}
			</div>
		</div>
	</div>
</div>
