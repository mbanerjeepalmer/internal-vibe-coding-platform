<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		role,
		name = role === 'agent' ? 'Agent' : 'Alexandra',
		children
	}: { role: 'user' | 'agent'; name?: string; children: Snippet } = $props();
</script>

<div class="flex {role === 'user' ? 'justify-end' : 'justify-start'}" data-testid="chat-message-{role}">
	<div class="max-w-lg">
		<p class="mb-1 text-xs text-stone-400 {role === 'user' ? 'text-right' : ''}">{name}</p>
		<div
			class="rounded-2xl px-4 py-2.5 text-sm leading-relaxed {role === 'user'
				? 'bg-amber-600 text-white'
				: 'bg-stone-100 text-stone-800'}"
		>
			{@render children()}
		</div>
	</div>
</div>
