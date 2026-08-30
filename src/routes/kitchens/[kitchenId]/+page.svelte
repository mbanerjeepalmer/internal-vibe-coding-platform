<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let showCreateApp = $state(false);
	let guidance = $state(data.kitchen.agentGuidance ?? '');
</script>

<div class="min-h-screen bg-stone-50">
	<header class="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-3">
		<div class="flex items-center gap-3">
			<span class="text-xl">🍳</span>
			<div>
				<a href="/home" class="text-xs text-stone-500 hover:underline">← All kitchens</a>
				<p class="text-sm font-semibold text-stone-900">{data.kitchen.name}</p>
			</div>
		</div>
	</header>

	<div class="mx-auto flex max-w-3xl flex-col gap-8 p-6">
		{#if form?.message}
			<p class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
				{form.message}
			</p>
		{/if}

		<section>
			<div class="mb-3 flex items-center justify-between">
				<h1 class="text-sm font-semibold text-stone-900">Apps</h1>
				<button
					type="button"
					onclick={() => (showCreateApp = !showCreateApp)}
					class="text-xs font-medium text-amber-700 hover:underline"
				>
					{showCreateApp ? 'Cancel' : '+ New app'}
				</button>
			</div>

			{#if showCreateApp}
				<form
					method="POST"
					action="?/createApp"
					use:enhance
					class="mb-4 flex gap-2 rounded-lg border border-stone-200 bg-white p-3"
				>
					<input
						name="name"
						required
						placeholder="App name"
						class="flex-1 rounded-md border border-stone-300 px-3 py-1.5 text-sm"
					/>
					<button
						type="submit"
						class="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
					>
						Create
					</button>
				</form>
			{/if}

			{#if data.apps.length === 0}
				<p class="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
					No apps in this Kitchen yet.
				</p>
			{:else}
				<ul class="flex flex-col gap-2">
					{#each data.apps as app (app.id)}
						<li>
							<a
								href={`/apps/${app.id}`}
								class="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700 hover:bg-stone-50"
							>
								<span>{app.name}</span>
								<span class="text-xs text-stone-400">{app.sandboxState}</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section>
			<h2 class="mb-3 text-sm font-semibold text-stone-900">Members</h2>
			<ul class="flex flex-col gap-2">
				{#each data.members as member (member.id)}
					<li class="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-4 py-2.5">
						<a href={`/users/${member.id}`} class="text-sm text-stone-900 hover:underline">
							{member.name || member.email}
						</a>
						<span class="text-xs text-stone-500">{member.role === 'head_chef' ? 'Head Chef' : 'Chef'}</span>
					</li>
				{/each}
			</ul>
		</section>

		<section class="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
			<h2 class="text-base font-semibold text-stone-900">Agent rules</h2>
			<p class="mt-1 text-sm text-stone-600">These rules are shared by every app in this Kitchen.</p>
			{#if data.kitchen.role === 'head_chef'}
				<form method="POST" action="?/saveGuidance" use:enhance class="mt-4 space-y-3">
					<textarea
						bind:value={guidance}
						name="guidance"
						maxlength="12000"
						rows="10"
						placeholder="For non-technical users: work out sensible next steps, ask only essential questions, and explain changes in plain English."
						class="w-full rounded-md border border-stone-300 p-3 text-sm text-stone-800"
					></textarea>
					<button
						type="submit"
						class="rounded-md bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-800"
					>
						Save rules
					</button>
				</form>
			{:else}
				<p class="mt-4 rounded-md bg-stone-50 p-3 text-sm text-stone-600">
					Only the Head Chef can change these rules.
				</p>
			{/if}
		</section>
	</div>
</div>
