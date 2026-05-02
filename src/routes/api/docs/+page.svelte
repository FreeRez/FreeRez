<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>FreeRez API Documentation</title>
</svelte:head>

<div class="min-h-screen bg-background p-8">
	<div class="mx-auto max-w-4xl">
		<h1 class="text-3xl font-bold text-foreground">FreeRez API Documentation</h1>
		<p class="mt-2 text-muted-foreground">
			Open-source restaurant reservation platform. OpenTable-compatible API.
		</p>

		<div class="mt-6 rounded-lg border border-border p-4">
			<h2 class="font-semibold">OpenAPI Specification</h2>
			<p class="mt-1 text-sm text-muted-foreground">
				Download or view the full API specification:
			</p>
			<a
				href="/openapi.json"
				class="mt-2 inline-block rounded bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
			>
				Download OpenAPI 3.1 Spec
			</a>
		</div>

		<div class="mt-8 space-y-6">
			<section>
				<h2 class="text-xl font-semibold">Authentication</h2>
				<p class="mt-1 text-sm text-muted-foreground">
					All API requests require a Bearer token obtained via OAuth 2.0 client credentials flow.
				</p>
				<pre class="mt-2 overflow-x-auto rounded bg-muted p-3 text-xs font-mono">POST /api/v1/oauth/token?grant_type=client_credentials
Authorization: Basic {'base64(client_id:client_secret)'}</pre>
			</section>

			<section>
				<h2 class="text-xl font-semibold">Base URL</h2>
				<pre class="mt-2 overflow-x-auto rounded bg-muted p-3 text-xs font-mono">{data.baseUrl}</pre>
			</section>

			<section>
				<h2 class="text-xl font-semibold">Endpoints</h2>
				<div class="mt-3 space-y-2 text-sm">
					{#each data.groups as group}
						<div class="rounded border border-border p-3">
							<h3 class="font-medium">{group.name}</h3>
							<ul class="mt-1 space-y-1 text-muted-foreground">
								{#each group.endpoints as ep}
									<li><code class="text-xs">{ep}</code></li>
								{/each}
							</ul>
						</div>
					{/each}
				</div>
			</section>
		</div>
	</div>
</div>
