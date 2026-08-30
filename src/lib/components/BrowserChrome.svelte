<script lang="ts">
	import type { Snippet } from 'svelte';

	let { url, children }: { url: string; children: Snippet } = $props();
</script>

<div class="overflow-hidden rounded-xl border border-stone-300 shadow-sm">
	<div class="flex items-center gap-2 border-b border-stone-200 bg-stone-100 px-3 py-2">
		<span class="h-2.5 w-2.5 rounded-full bg-red-400"></span>
		<span class="h-2.5 w-2.5 rounded-full bg-amber-400"></span>
		<span class="h-2.5 w-2.5 rounded-full bg-green-400"></span>
		<div class="ml-2 flex-1 truncate rounded-md bg-white px-3 py-1 text-xs text-stone-500">
			{url}
		</div>
	</div>
	<div class="bg-white">
		{@render children()}
	</div>
</div>
