<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let showCreateApp = $state(false);
	let guidance = $state(data.kitchen.agentGuidance ?? '');
	let kitchenName = $state(data.kitchen.name);
	let kitchenDescription = $state(data.kitchen.description ?? '');
	let selectedSkillIds = $state(new Set(data.skillIds));
</script>

<div class="min-h-screen bg-stone-50">
	<header class="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-3">
		<div class="flex items-center gap-3">
			<span class="text-xl">🍳</span>
			<div>
				<a href="/home" class="text-xs text-stone-500 hover:underline">← All kitchens</a>
				<p class="text-sm font-semibold text-stone-900">{data.kitchen.name}</p>
				{#if data.kitchen.description}
					<p class="text-xs text-stone-500">{data.kitchen.description}</p>
				{/if}
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

		{#if data.kitchen.role === 'head_chef'}
			<section class="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
				<h2 class="text-base font-semibold text-stone-900">Kitchen profile</h2>
				<p class="mt-1 text-sm text-stone-600">Rename this Kitchen or give it a short description.</p>
				<form method="POST" action="?/saveProfile" use:enhance class="mt-4 flex flex-col gap-3">
					<label class="block">
						<span class="mb-1 block text-xs font-medium text-stone-600">Name</span>
						<input
							bind:value={kitchenName}
							name="name"
							required
							class="w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-800"
						/>
					</label>
					<label class="block">
						<span class="mb-1 block text-xs font-medium text-stone-600">Description</span>
						<textarea
							bind:value={kitchenDescription}
							name="description"
							maxlength="500"
							rows="2"
							placeholder="What is this Kitchen for?"
							class="w-full rounded-md border border-stone-300 p-3 text-sm text-stone-800"
						></textarea>
					</label>
					<button
						type="submit"
						class="self-start rounded-md bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-800"
					>
						Save profile
					</button>
				</form>
			</section>

			<section class="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
				<h2 class="text-base font-semibold text-stone-900">Skills</h2>
				<p class="mt-1 text-sm text-stone-600">
					Turn on skills every App agent in this Kitchen should follow, alongside the agent rules
					below.
				</p>
				<form method="POST" action="?/saveSkills" use:enhance class="mt-4 flex flex-col gap-3">
					{#each data.skillCatalog as skillOption (skillOption.id)}
						<label class="flex items-start gap-2 rounded-md border border-stone-200 p-3">
							<input
								type="checkbox"
								name="skillIds"
								value={skillOption.id}
								checked={selectedSkillIds.has(skillOption.id)}
								onchange={(e) => {
									const next = new Set(selectedSkillIds);
									if ((e.target as HTMLInputElement).checked) next.add(skillOption.id);
									else next.delete(skillOption.id);
									selectedSkillIds = next;
								}}
								class="mt-0.5"
							/>
							<span>
								<span class="block text-sm font-medium text-stone-900">{skillOption.name}</span>
								<span class="block text-xs text-stone-500">{skillOption.summary}</span>
							</span>
						</label>
					{/each}
					<button
						type="submit"
						class="self-start rounded-md bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-800"
					>
						Save skills
					</button>
				</form>
			</section>
		{/if}

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
