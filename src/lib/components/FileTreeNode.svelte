<script lang="ts">
	import type { FileTree, FileEntry } from '$lib/files/fileTree.svelte';
	import FileTreeNode from './FileTreeNode.svelte';

	let { tree, entry, depth = 0 }: { tree: FileTree; entry: FileEntry; depth?: number } = $props();
</script>

{#if entry.isDir}
	<div>
		<button
			type="button"
			class="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-xs hover:bg-slate-100 {tree.selected ===
			entry.path
				? 'bg-blue-50 text-blue-700'
				: 'text-slate-700'}"
			style={`padding-left: ${depth * 12 + 4}px`}
			onclick={() => {
				tree.toggle(entry.path);
				tree.select(entry.path);
			}}
		>
			<span class="w-3 shrink-0">{tree.isExpanded(entry.path) ? '▾' : '▸'}</span>
			<span class="truncate">📁 {entry.name}</span>
		</button>
		{#if tree.isExpanded(entry.path)}
			{#if tree.isLoading(entry.path)}
				<p
					class="text-shimmer px-2 text-[11px] text-slate-400"
					style={`padding-left: ${(depth + 1) * 12 + 4}px`}
				>
					Loading…
				</p>
			{:else}
				{#each tree.children[entry.path] ?? [] as child (child.path)}
					<FileTreeNode {tree} entry={child} depth={depth + 1} />
				{/each}
			{/if}
		{/if}
	</div>
{:else}
	<div
		class="truncate px-1 py-0.5 text-xs text-slate-500"
		style={`padding-left: ${depth * 12 + 20}px`}
		title={entry.name}
	>
		📄 {entry.name}
	</div>
{/if}
