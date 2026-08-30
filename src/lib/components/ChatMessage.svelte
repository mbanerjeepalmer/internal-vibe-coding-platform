<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		role,
		name = role === 'agent' ? 'Agent' : 'Alexandra',
		children
	}: { role: 'user' | 'agent'; name?: string; children: Snippet } = $props();
</script>

<div class="flex gap-3" data-testid="chat-message-{role}">
	<div
		class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs {role === 'user'
			? 'bg-slate-800 text-white'
			: 'bg-blue-600 text-white'}"
	>
		{role === 'user' ? name.charAt(0) : '✳'}
	</div>
	<div class="min-w-0 flex-1">
		<p class="mb-1 text-xs font-medium text-slate-500">{role === 'user' ? name : 'Agent'}</p>
		<div class="text-sm leading-relaxed text-slate-800">
			{@render children()}
		</div>
	</div>
</div>
