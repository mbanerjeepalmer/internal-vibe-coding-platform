<script lang="ts">
	import { untrack } from 'svelte';
	import { FileTree } from '$lib/files/fileTree.svelte';
	import FileTreeNode from './FileTreeNode.svelte';

	let { appId }: { appId: string } = $props();

	const tree = new FileTree(appId);
	let fileInput: HTMLInputElement;
	let dragOver = $state(false);

	// `tree.init()` reads-then-writes `tree.loading` before its first
	// `await` (see `FileTree.load`'s first line) — left untracked, that read
	// would register as a dependency of this effect, and the very next line's
	// write to the same field would then re-trigger it, looping forever.
	// `untrack` keeps this a plain "run once on mount".
	$effect(() => {
		untrack(() => tree.init());
	});

	function onFilesPicked(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files?.length) tree.upload(input.files);
		input.value = '';
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		if (e.dataTransfer?.files?.length) tree.upload(e.dataTransfer.files);
	}
</script>

<div
	class="relative flex h-full flex-col"
	role="region"
	aria-label="Project files"
	ondragover={(e) => {
		e.preventDefault();
		dragOver = true;
	}}
	ondragleave={() => (dragOver = false)}
	ondrop={onDrop}
>
	<div class="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
		<div class="min-w-0 truncate text-xs text-slate-500">
			Uploading to <span class="font-medium text-slate-800">/{tree.selected}</span>
		</div>
		<button
			type="button"
			data-testid="upload-files"
			onclick={() => fileInput.click()}
			disabled={tree.uploading}
			class="shrink-0 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
		>
			{tree.uploading ? 'Uploading…' : '⬆️ Upload'}
		</button>
		<input
			bind:this={fileInput}
			type="file"
			multiple
			class="hidden"
			data-testid="upload-files-input"
			onchange={onFilesPicked}
		/>
	</div>

	{#if tree.error}
		<p class="border-b border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">{tree.error}</p>
	{/if}

	<div class="flex-1 overflow-y-auto p-2" data-testid="file-tree">
		<button
			type="button"
			class="mb-1 flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-xs hover:bg-slate-100 {tree.selected ===
			''
				? 'bg-blue-50 text-blue-700'
				: 'text-slate-700'}"
			onclick={() => tree.select('')}
		>
			📁 (project root)
		</button>
		{#if tree.isLoading('')}
			<p class="text-shimmer px-2 text-xs text-slate-400">Loading…</p>
		{:else}
			{#each tree.children[''] ?? [] as entry (entry.path)}
				<FileTreeNode {tree} {entry} depth={1} />
			{/each}
		{/if}
	</div>

	{#if dragOver}
		<div
			class="pointer-events-none absolute inset-0 flex items-center justify-center border-2 border-dashed border-blue-400 bg-blue-50/70 text-sm font-medium text-blue-700"
		>
			Drop to upload to /{tree.selected}
		</div>
	{/if}
</div>
