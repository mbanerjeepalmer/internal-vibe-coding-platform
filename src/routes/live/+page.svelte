<script lang="ts">
	import TopBar from '$lib/components/TopBar.svelte';
	import ChatMessage from '$lib/components/ChatMessage.svelte';
	import ToolCall from '$lib/components/ToolCall.svelte';
	import Composer from '$lib/components/Composer.svelte';
	import { page } from '$app/state';
	import { OpencodeSession } from '$lib/opencode/session.svelte';

	// One opencode session per project; defaults to a single demo project until
	// the real Kitchen/project model lands (see docs/01_hardcoded_demo.md).
	// `?project=` override exists for local testing against a specific sandbox.
	const session = new OpencodeSession(page.url.searchParams.get('project') ?? 'demo-project');
	let composerValue = $state('');
	let ready = $state(false);
	let initError = $state<string | null>(null);

	$effect(() => {
		session
			.init()
			.then(() => (ready = true))
			.catch((err) => (initError = err instanceof Error ? err.message : String(err)));
		return () => session.dispose();
	});

	function submit(text: string) {
		composerValue = '';
		session.sendPrompt(text);
	}

	function toolIcon(tool: string) {
		if (tool.includes('read') || tool.includes('list') || tool.includes('grep')) return '🔎';
		if (tool.includes('write') || tool.includes('edit')) return '📝';
		if (tool.includes('bash') || tool.includes('shell')) return '💻';
		return '⚙️';
	}
</script>

<div class="flex h-screen flex-col overflow-hidden">
	<TopBar name="Alexandra" role="Chef" />

	<div class="flex flex-1 overflow-hidden">
		<aside class="hidden w-56 shrink-0 flex-col border-r border-slate-200 bg-slate-50/60 p-3 md:flex">
			<p class="mb-2 px-2 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
				Sessions
			</p>
			<div class="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2 text-sm shadow-sm">
				<span
					class="h-1.5 w-1.5 shrink-0 rounded-full {session.busy ? 'bg-blue-500' : 'bg-emerald-500'}"
				></span>
				<span class="truncate text-slate-700">opencode live session</span>
			</div>

			{#if session.models.length > 0}
				<p class="mt-4 mb-2 px-2 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
					Model
				</p>
				<select
					class="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
					value={session.model?.id}
					onchange={(e) => {
						const m = session.models.find((m) => m.id === (e.target as HTMLSelectElement).value);
						if (m) session.setModel(m);
					}}
				>
					{#each session.models as m (m.id)}
						<option value={m.id}>{m.name}{m.free ? ' (free)' : ''}</option>
					{/each}
				</select>
			{/if}
		</aside>

		<section class="flex min-w-0 flex-1 flex-col">
			<div class="flex-1 space-y-5 overflow-y-auto p-6" data-testid="live-timeline">
				{#if initError}
					<ChatMessage role="agent">
						<p class="text-red-600">
							Couldn't reach the opencode sandbox: {initError}. Is <code>opencode serve</code>
							available on this machine?
						</p>
					</ChatMessage>
				{:else if !ready}
					<p class="text-shimmer text-sm text-slate-400">Starting sandbox…</p>
				{:else}
					<ChatMessage role="agent">Hi! I'm running for real via opencode. Ask me anything.</ChatMessage>
				{/if}

				{#each session.items as item (item.id)}
					{#if item.kind === 'user'}
						<ChatMessage role="user">{item.text}</ChatMessage>
					{:else if item.kind === 'agent-text'}
						<ChatMessage role="agent">
							{#if item.done}
								{item.text}
							{:else}
								<span class="text-shimmer">Thinking…</span>
							{/if}
						</ChatMessage>
					{:else if item.kind === 'tool'}
						<ToolCall
							icon={toolIcon(item.tool)}
							status={item.status}
							activeLabel={`Running ${item.tool}`}
							doneLabel={item.status === 'error' ? `${item.tool} failed` : `Ran ${item.tool}`}
						>
							{#snippet children()}
								<pre class="whitespace-pre-wrap">{JSON.stringify(item.input, null, 2)}</pre>
								{#if item.error}
									<p class="mt-1 text-red-500">{item.error}</p>
								{/if}
							{/snippet}
						</ToolCall>
					{:else if item.kind === 'error'}
						<ChatMessage role="agent">
							<p class="text-red-600">⚠️ {item.message}</p>
						</ChatMessage>
					{/if}
				{/each}
			</div>

			<div class="border-t border-slate-200 bg-white p-4">
				<Composer
					bind:value={composerValue}
					showAttach={false}
					disabled={!ready}
					busy={session.busy}
					placeholder="Ask opencode to do something"
					onSubmit={submit}
				/>
			</div>
		</section>
	</div>
</div>
