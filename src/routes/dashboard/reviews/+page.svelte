<script lang="ts">
	import { Download, Star, MessageSquare } from 'lucide-svelte';
	import type { NormalizedReview } from '$lib/server/dashboard/normalize';

	let { data } = $props();
	const reviews: NormalizedReview[] = $derived(data.reviews);

	const totalReviews = $derived(reviews.length);
	const avgOverall = $derived(totalReviews > 0 ? +(reviews.reduce((s, r) => s + r.overall, 0) / totalReviews).toFixed(1) : 0);
	const avgFood = $derived(totalReviews > 0 ? +(reviews.reduce((s, r) => s + r.food, 0) / totalReviews).toFixed(1) : 0);
	const avgService = $derived(totalReviews > 0 ? +(reviews.reduce((s, r) => s + r.service, 0) / totalReviews).toFixed(1) : 0);
	const avgAmbience = $derived(totalReviews > 0 ? +(reviews.reduce((s, r) => s + r.ambience, 0) / totalReviews).toFixed(1) : 0);
	const avgValue = $derived(totalReviews > 0 ? +(reviews.reduce((s, r) => s + r.value, 0) / totalReviews).toFixed(1) : 0);

	const distribution = $derived([5, 4, 3, 2, 1].map(star => ({
		star,
		count: reviews.filter(r => r.overall === star).length
	})));

	let replyingTo = $state<string | null>(null);
	let replyMessage = $state('');

	const categories = $derived([
		{ label: 'Food', value: avgFood },
		{ label: 'Service', value: avgService },
		{ label: 'Ambience', value: avgAmbience },
		{ label: 'Value', value: avgValue }
	]);
</script>

<div class="fr-content">
	<div class="fr-page-head">
		<div>
			<h1 class="fr-page-title">Reviews</h1>
			<p class="fr-page-sub">{totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}{totalReviews > 0 ? ` · ${avgOverall} average` : ''}</p>
		</div>
		<div class="fr-row" style="gap: 8px">
			<button class="fr-btn" onclick={() => {
				const csv = ['Name,Rating,Date,Text'].concat(
					reviews.map(r => `"${r.name}",${r.overall},"${r.date}","${r.text.replace(/"/g, '""')}"`)
				).join('\n');
				const blob = new Blob([csv], { type: 'text/csv' });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = 'reviews.csv';
				a.click();
				URL.revokeObjectURL(url);
			}}><Download size={14} /> Export</button>
		</div>
	</div>

	{#if totalReviews === 0}
		<div class="fr-card fr-card-pad" style="text-align: center; padding: 60px 20px">
			<Star size={40} color="var(--fr-text-muted)" style="opacity: 0.3" />
			<h2 style="margin-top: 16px; font-size: 18px; font-weight: 600">No reviews yet</h2>
			<p class="fr-subtle" style="margin-top: 8px; font-size: 14px; max-width: 360px; margin-inline: auto">Reviews from diners will appear here once guests start leaving feedback after their visits.</p>
		</div>
	{:else}
	<div style="display: grid; grid-template-columns: 320px 1fr; gap: 18px; align-items: start">
		<!-- Summary sidebar -->
		<div class="fr-card fr-card-pad">
			<div style="text-align: center; margin-bottom: 20px">
				<div style="font-size: 56px; font-weight: 700; line-height: 1; letter-spacing: -2px" class="fr-num">{avgOverall}</div>
				<div style="display: flex; justify-content: center; gap: 2px; margin: 10px 0 6px">
					{#each Array(5) as _, i (i)}
						<Star size={18} fill="var(--fr-accent)" color="var(--fr-accent)" />
					{/each}
				</div>
				<div class="fr-subtle" style="font-size: 13px">{totalReviews} reviews</div>
			</div>

			<!-- Distribution bars -->
			<div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px">
				{#each distribution as d (d.star)}
					<div style="display: grid; grid-template-columns: 40px 1fr 28px; align-items: center; gap: 8px">
						<div class="fr-subtle" style="font-size: 12px; text-align: right">{d.star} star{d.star !== 1 ? 's' : ''}</div>
						<div style="height: 8px; border-radius: 4px; background: var(--fr-surface-muted); overflow: hidden">
							<div style="height: 100%; width: {totalReviews > 0 ? (d.count / totalReviews) * 100 : 0}%; background: var(--fr-accent); border-radius: 4px; transition: width 0.3s ease"></div>
						</div>
						<div class="fr-num fr-subtle" style="font-size: 12px">{d.count}</div>
					</div>
				{/each}
			</div>

			<!-- Category ratings -->
			<div style="border-top: 1px solid var(--fr-border); padding-top: 16px">
				<div class="fr-section-title" style="margin-bottom: 12px">Categories</div>
				<div style="display: flex; flex-direction: column; gap: 10px">
					{#each categories as cat (cat.label)}
						<div style="display: flex; justify-content: space-between; align-items: center">
							<span style="font-size: 13px">{cat.label}</span>
							<span class="fr-num" style="font-weight: 600; font-size: 13px">{cat.value}</span>
						</div>
					{/each}
				</div>
			</div>
		</div>

		<!-- Review list -->
		<div style="display: flex; flex-direction: column; gap: 14px">
			{#each reviews as review (review.id)}
				<div class="fr-card fr-card-pad">
					<div style="display: flex; gap: 12px; align-items: flex-start">
						<div class="fr-avatar">{review.initials}</div>
						<div style="flex: 1; min-width: 0">
							<div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap">
								<span style="font-weight: 600; font-size: 14px">{review.name}</span>
								{#if review.source === 'google-my-business'}
									<span class="fr-badge" style="font-size: 10px; padding: 1px 6px; background: var(--fr-surface-muted); border: 1px solid var(--fr-border)">Google</span>
								{/if}
								<div style="display: flex; gap: 1px">
									{#each Array(5) as _, i (i)}
										{#if i < review.overall}
											<Star size={13} fill="var(--fr-accent)" color="var(--fr-accent)" />
										{:else}
											<Star size={13} color="var(--fr-border)" />
										{/if}
									{/each}
								</div>
								<span class="fr-subtle" style="font-size: 12px; margin-left: auto">{review.date}</span>
							</div>

							<div style="margin-top: 8px; font-size: 13.5px; line-height: 1.6; color: var(--fr-text-muted)">
								"{review.text}"
							</div>

							{#if review.tags.length > 0}
								<div style="display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap">
									{#each review.tags as tag (tag)}
										<span class="fr-tag">{tag}</span>
									{/each}
								</div>
							{/if}

							{#if review.reply}
								<div style="margin-top: 14px; padding: 12px 14px; background: var(--fr-surface-muted); border-left: 3px solid var(--fr-accent); border-radius: 4px">
									<div style="font-size: 12px; font-weight: 600; margin-bottom: 4px">{review.reply.author}</div>
									<div style="font-size: 12.5px; line-height: 1.5; color: var(--fr-text-muted)">{review.reply.text}</div>
								</div>
							{:else if replyingTo === review.id}
								<div style="margin-top: 12px; display: flex; gap: 8px">
									<input class="fr-input" style="flex: 1" placeholder="Write a reply..." bind:value={replyMessage} />
									<button class="fr-btn fr-btn-primary fr-btn-sm" onclick={async () => {
										const fd = new FormData();
										fd.set('reviewId', review.id);
										fd.set('message', replyMessage);
										fd.set('author', 'Restaurant');
										await fetch('/dashboard/reviews?/reply', { method: 'POST', body: fd });
										const { invalidateAll } = await import('$app/navigation');
										await invalidateAll();
										replyingTo = null;
										replyMessage = '';
									}}>Send</button>
									<button class="fr-btn fr-btn-sm" onclick={() => { replyingTo = null; replyMessage = ''; }}>Cancel</button>
								</div>
							{:else}
								<div style="margin-top: 12px">
									<button class="fr-btn fr-btn-sm fr-btn-ghost" onclick={() => replyingTo = review.id}><MessageSquare size={13} /> Reply</button>
								</div>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	</div>
	{/if}
</div>
