<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let displayName = $state(data.user.name ?? '');
	let saving = $state(false);
	let saved = $state(false);
	let errorMessage = $state<string | null>(null);

	async function save(e: SubmitEvent) {
		e.preventDefault();
		const trimmed = displayName.trim();
		if (!trimmed) {
			errorMessage = 'Display name is required.';
			return;
		}
		saving = true;
		saved = false;
		errorMessage = null;
		const { error } = await authClient.updateUser({ name: trimmed });
		saving = false;
		if (error) {
			errorMessage = error.message ?? 'Could not update your display name.';
			return;
		}
		saved = true;
		await invalidateAll();
	}
</script>

<div class="min-h-screen bg-stone-50">
	<header class="flex items-center gap-3 border-b border-stone-200 bg-white px-6 py-3">
		<span class="text-xl">⚙️</span>
		<div>
			<a href="/home" class="text-xs text-stone-500 hover:underline">← Dashboard</a>
			<p class="text-sm font-semibold text-stone-900">Account settings</p>
		</div>
	</header>

	<div class="mx-auto max-w-md p-6">
		<form onsubmit={save} class="flex flex-col gap-4 rounded-lg border border-stone-200 bg-white p-4">
			<div>
				<label for="email" class="mb-1 block text-xs font-medium text-stone-500">Email</label>
				<p id="email" class="text-sm text-stone-700">{data.user.email}</p>
			</div>

			<div>
				<label for="displayName" class="mb-1 block text-xs font-medium text-stone-500">Display name</label>
				<input
					id="displayName"
					bind:value={displayName}
					required
					class="w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm"
				/>
			</div>

			{#if errorMessage}
				<p class="text-sm text-red-600">{errorMessage}</p>
			{/if}
			{#if saved}
				<p class="text-sm text-emerald-600">Saved.</p>
			{/if}

			<button
				type="submit"
				disabled={saving}
				class="self-start rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
			>
				{saving ? 'Saving…' : 'Save'}
			</button>
		</form>
	</div>
</div>
