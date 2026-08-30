<script lang="ts">
	import TopBar from '$lib/components/TopBar.svelte';
	import { kitchenConfig, proposedChange } from '$lib/data/config-diff';
	import { kitchenName } from '$lib/data/chefs';

	let proposed = $state(false);
</script>

<div class="flex min-h-screen flex-col">
	<TopBar name="Alexandra" role="Chef" />

	<div class="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
		<div>
			<h1 class="text-lg font-semibold text-stone-900">{kitchenName} · Kitchen config</h1>
			<p class="text-sm text-stone-500">
				Set by Maurice — shared by every project chefs build in this Kitchen.
			</p>
		</div>

		<div class="rounded-lg border border-stone-200 bg-white p-4">
			<p class="mb-3 text-xs font-semibold tracking-wide text-stone-400 uppercase">Current config</p>
			<ul class="space-y-2 text-sm">
				{#each kitchenConfig as item (item.label)}
					<li class="flex gap-2">
						<span class="font-medium text-stone-700">{item.label}:</span>
						<span class="text-stone-600">{item.value}</span>
					</li>
				{/each}
			</ul>
		</div>

		<div class="rounded-lg border border-emerald-200 bg-emerald-50 p-4" data-testid="config-diff">
			<p class="mb-2 text-xs font-semibold tracking-wide text-emerald-700 uppercase">
				+ Proposed by {proposedChange.proposedBy}
			</p>
			<p class="mb-1 text-sm font-semibold text-stone-900">{proposedChange.title}</p>
			<p class="text-sm text-stone-600">{proposedChange.body}</p>

			{#if !proposed}
				<button
					type="button"
					data-testid="propose-change"
					onclick={() => (proposed = true)}
					class="mt-4 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
				>
					Propose change to Maurice
				</button>
			{:else}
				<p
					class="mt-4 inline-block rounded-md bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-800"
					data-testid="proposed-status"
				>
					Proposed — pending Maurice's review
				</p>
			{/if}
		</div>

		<a href="/login?as=maurice" data-testid="log-in-as-maurice" class="text-sm text-amber-700 hover:underline">
			Log out, then log in as Maurice →
		</a>
	</div>
</div>
