<script lang="ts">
	import TopBar from '$lib/components/TopBar.svelte';

	type Status = 'idle' | 'running' | 'done' | 'error';

	let status = $state<Status>('idle');
	let action = $state<'deploy' | 'destroy' | null>(null);
	let log = $state('');
	let url = $state<string | undefined>(undefined);

	async function run(kind: 'deploy' | 'destroy') {
		status = 'running';
		action = kind;
		log = '';
		url = undefined;
		try {
			const res = await fetch(`/api/counter/${kind}`, { method: 'POST' });
			const body = (await res.json()) as { success: boolean; log?: string; url?: string };
			log = body.log ?? '';
			url = body.url;
			status = body.success ? 'done' : 'error';
		} catch (err) {
			log = err instanceof Error ? err.message : String(err);
			status = 'error';
		}
	}
</script>

<div class="flex min-h-screen flex-col">
	<TopBar name="Maurice" role="Kitchen owner" />

	<div class="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
		<div>
			<h1 class="text-lg font-semibold text-stone-900">Counter app</h1>
			<p class="text-sm text-stone-500">
				v0.2.1 proof of concept: a real sandbox writes and builds this app, and a real Cloudflare
				Worker gets deployed.
			</p>
		</div>

		<div class="flex gap-3">
			<button
				data-testid="build-deploy"
				disabled={status === 'running'}
				onclick={() => run('deploy')}
				class="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
			>
				{status === 'running' && action === 'deploy' ? 'Building & deploying…' : 'Build & deploy'}
			</button>
			<button
				data-testid="destroy"
				disabled={status === 'running'}
				onclick={() => run('destroy')}
				class="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:border-stone-400 disabled:opacity-50"
			>
				{status === 'running' && action === 'destroy' ? 'Destroying…' : 'Destroy'}
			</button>
		</div>

		{#if url}
			<p class="text-sm text-stone-700">
				Live at
				<a href={url} target="_blank" rel="noreferrer" class="font-medium text-amber-700 underline"
					>{url}</a
				>
			</p>
		{/if}

		{#if status === 'error'}
			<p class="text-sm font-medium text-red-700">The sandbox reported a failure -- see the log below.</p>
		{/if}

		{#if log}
			<pre
				data-testid="log"
				class="max-h-96 overflow-auto rounded-lg bg-stone-900 p-4 text-xs whitespace-pre-wrap text-stone-100">{log}</pre>
		{/if}
	</div>
</div>
