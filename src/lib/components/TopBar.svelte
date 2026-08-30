<script lang="ts">
	let {
		kitchenName,
		kitchenHref,
		appName,
		onRenameApp,
		name,
		userHref,
		role,
		logoutHref = '/home'
	}: {
		kitchenName: string;
		kitchenHref: string;
		appName: string;
		onRenameApp: (name: string) => void;
		name: string;
		userHref: string;
		role: string;
		logoutHref?: string;
	} = $props();

	let editingAppName = $state(false);
	let appNameDraft = $state(appName);
	let appNameInput: HTMLInputElement;

	function startEditingAppName() {
		appNameDraft = appName;
		editingAppName = true;
	}

	async function commitAppName() {
		editingAppName = false;
		const trimmed = appNameDraft.trim();
		if (trimmed && trimmed !== appName) onRenameApp(trimmed);
	}

	function onAppNameKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') appNameInput.blur();
		else if (e.key === 'Escape') {
			appNameDraft = appName;
			editingAppName = false;
		}
	}

	$effect(() => {
		if (editingAppName) appNameInput?.focus();
	});
</script>

<header
	class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-stone-200 bg-white px-3 py-2 sm:px-6 sm:py-3"
>
	<div class="flex min-w-0 items-center gap-2 text-sm">
		<span class="text-xl">🍳</span>
		<a href={kitchenHref} class="shrink-0 font-semibold text-stone-900 hover:underline">
			{kitchenName}
		</a>
		<span class="shrink-0 text-stone-300">/</span>
		{#if editingAppName}
			<input
				bind:this={appNameInput}
				bind:value={appNameDraft}
				onblur={commitAppName}
				onkeydown={onAppNameKeydown}
				class="min-w-0 flex-1 rounded border border-stone-300 px-1.5 py-0.5 font-semibold text-stone-900"
			/>
		{:else}
			<button
				type="button"
				onclick={startEditingAppName}
				title="Rename app"
				class="min-w-0 truncate rounded px-1 py-0.5 text-left font-semibold text-stone-900 hover:bg-stone-100"
			>
				{appName}
			</button>
		{/if}
	</div>
	<div class="flex shrink-0 items-center gap-2 sm:gap-4">
		<div class="text-right">
			<a href={userHref} class="text-sm font-medium text-stone-900 hover:underline">{name}</a>
			<p class="text-xs text-stone-500">{role}</p>
		</div>
		<a
			href={logoutHref}
			class="hidden rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 sm:block"
		>
			Back to dashboard
		</a>
		<a
			href={logoutHref}
			title="Back to dashboard"
			aria-label="Back to dashboard"
			class="rounded-md border border-stone-300 px-2.5 py-1.5 text-sm text-stone-600 hover:bg-stone-100 sm:hidden"
		>
			←
		</a>
	</div>
</header>
