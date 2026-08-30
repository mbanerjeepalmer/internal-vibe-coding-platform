<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="min-h-screen bg-stone-50">
	<header class="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-3">
		<div class="flex items-center gap-3">
			<span class="text-xl">👤</span>
			<div>
				<a href="/home" class="text-xs text-stone-500 hover:underline">← Dashboard</a>
				<p class="text-sm font-semibold text-stone-900">{data.profile.user.name || data.profile.user.email}</p>
			</div>
		</div>
		{#if data.isSelf}
			<a
				href="/account"
				class="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100"
			>
				Edit profile
			</a>
		{/if}
	</header>

	<div class="mx-auto flex max-w-3xl flex-col gap-8 p-6">
		<section>
			<h1 class="mb-3 text-sm font-semibold text-stone-900">Apps</h1>
			{#if data.profile.kitchens.length === 0}
				<p class="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
					No shared Kitchens yet.
				</p>
			{:else}
				<div class="flex flex-col gap-4">
					{#each data.profile.kitchens as kitchen (kitchen.id)}
						<div class="rounded-lg border border-stone-200 bg-white p-4">
							<a href={`/kitchens/${kitchen.id}`} class="text-sm font-semibold text-stone-900 hover:underline">
								{kitchen.name}
							</a>
							{#if kitchen.apps.length > 0}
								<ul class="mt-2 flex flex-col gap-1.5 border-t border-stone-100 pt-2">
									{#each kitchen.apps as app (app.id)}
										<li>
											<a
												href={`/apps/${app.id}`}
												class="flex items-center justify-between rounded-md px-2 py-1 text-sm text-stone-700 hover:bg-stone-50"
											>
												<span>{app.name}</span>
												<span class="text-xs text-stone-400">{app.sandboxState}</span>
											</a>
										</li>
									{/each}
								</ul>
							{:else}
								<p class="mt-2 text-xs text-stone-500">No apps yet.</p>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</section>
	</div>
</div>
