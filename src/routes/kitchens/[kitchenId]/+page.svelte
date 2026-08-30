<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let guidance = $state(data.kitchen.agentGuidance ?? '');
</script>

<main class="mx-auto max-w-2xl px-4 py-10">
	<a href="/home" class="text-sm text-amber-700 hover:underline">← All Kitchens</a>
	<h1 class="mt-4 text-2xl font-semibold text-stone-900">{data.kitchen.name}</h1>
	<p class="mt-1 text-sm text-stone-500">Kitchen settings</p>

	<section class="mt-8 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
		<h2 class="text-base font-semibold text-stone-900">Agent rules</h2>
		<p class="mt-1 text-sm text-stone-600">These rules are shared by every app in this Kitchen.</p>
		{#if data.kitchen.role === 'head_chef'}
			<form method="POST" action="?/saveGuidance" use:enhance class="mt-4 space-y-3">
				<textarea bind:value={guidance} name="guidance" maxlength="12000" rows="10" placeholder="For non-technical users: work out sensible next steps, ask only essential questions, and explain changes in plain English." class="w-full rounded-md border border-stone-300 p-3 text-sm text-stone-800"></textarea>
				<button type="submit" class="rounded-md bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-800">Save rules</button>
			</form>
		{:else}
			<p class="mt-4 rounded-md bg-stone-50 p-3 text-sm text-stone-600">Only the Head Chef can change these rules.</p>
		{/if}
	</section>
</main>
