<script lang="ts">
	import TopBar from '$lib/components/TopBar.svelte';
	import { chefs, kitchenName } from '$lib/data/chefs';
</script>

<div class="flex min-h-screen flex-col">
	<TopBar name="Maurice" role="Kitchen owner" />

	<div class="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
		<div>
			<h1 class="text-lg font-semibold text-stone-900">{kitchenName}</h1>
			<p class="text-sm text-stone-500">Your kitchen's chefs</p>
		</div>

		<ul class="flex flex-col gap-3">
			{#each chefs as chef (chef.slug)}
				<li>
					{#if chef.slug === 'alexandra'}
						<a
							href="/dashboard/alexandra"
							data-testid="chef-alexandra"
							class="block rounded-lg border border-stone-200 bg-white p-4 hover:border-amber-300"
						>
							<p class="text-sm font-semibold text-stone-900">{chef.name} · {chef.role}</p>
							<p class="text-xs text-stone-500">{chef.note}</p>
						</a>
					{:else}
						<div class="block rounded-lg border border-stone-200 bg-white p-4">
							<p class="text-sm font-semibold text-stone-900">{chef.name} · {chef.role}</p>
							<p class="text-xs text-stone-500">{chef.note}</p>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	</div>
</div>
