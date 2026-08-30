<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		icon = '⚙️',
		activeLabel,
		doneLabel,
		status = 'done',
		testId,
		children
	}: {
		icon?: string;
		activeLabel: string;
		doneLabel: string;
		status?: 'pending' | 'done' | 'error';
		testId?: string;
		children?: Snippet;
	} = $props();

	let expanded = $state(false);
</script>

<div class="rounded-lg border border-slate-200 bg-slate-50" data-testid={testId}>
	<button
		type="button"
		onclick={() => (expanded = !expanded)}
		class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs"
	>
		<span class="shrink-0">
			{#if status === 'error'}
				✗
			{:else if status === 'pending'}
				{icon}
			{:else}
				✓
			{/if}
		</span>
		<span class={status === 'pending' ? 'text-shimmer font-medium' : 'font-medium text-slate-700'}>
			{status === 'pending' ? activeLabel : doneLabel}
		</span>
		{#if children}
			<span class="ml-auto text-slate-400">{expanded ? '▲' : '▼'}</span>
		{/if}
	</button>
	{#if expanded && children}
		<div class="border-t border-slate-200 px-3 py-2 font-mono text-xs text-slate-600">
			{@render children()}
		</div>
	{/if}
</div>
