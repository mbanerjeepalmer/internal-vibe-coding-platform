<script lang="ts">
	let { appId }: { appId: string } = $props();
	let repositories = $state<Array<{ fullName: string; private: boolean; defaultBranch: string }> | null>(null);
	let branches = $state<Array<{ name: string }> | null>(null);
	let selected = $state('');
	let branch = $state('');
	let imported = $state('');
	let busy = $state(false);
	let message = $state('');
	let more = $state(false);
	async function importContent() {
		if (!selected || !branch) return;
		busy = true; message = ''; imported = '';
		try {
			const response = await fetch(`/api/kitchen/${appId}/github/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repository: selected, branch }) });
			const result = await response.json() as { message?: string; directory?: string; commit?: string; saved?: boolean };
			if (!response.ok) throw new Error(result.message ?? 'Import failed.');
			imported = `Imported ${selected} at ${result.commit} into ${result.directory}. ${result.saved ? 'Source snapshot saved.' : result.message ?? 'Source snapshot failed.'}`;
		} catch (error) { message = error instanceof Error ? error.message : 'Import failed.'; }
		finally { busy = false; }
	}
	async function load(repository?: string) {
		busy = true;
		message = '';
		try {
			const query = repository ? `?repository=${encodeURIComponent(repository)}` : '';
			const response = await fetch(`/api/kitchen/${appId}/github${query}`);
			const result = await response.json() as { message?: string; repositories?: Array<{ fullName: string; private: boolean; defaultBranch: string }>; branches?: Array<{ name: string }>; hasMore?: boolean };
			if (!response.ok) throw new Error(result.message ?? 'GitHub request failed.');
			if (repository) branches = result.branches ?? [];
			else { repositories = result.repositories ?? []; branches = null; }
			more = result.hasMore ?? false;
		} catch (error) { message = error instanceof Error ? error.message : 'GitHub request failed.'; }
		finally { busy = false; }
	}
</script>

<div class="space-y-2 rounded-md border border-slate-200 bg-white p-2 text-[11px] text-slate-600">
	<p class="font-medium">GitHub connection</p>
	<p>Add a fine-grained GitHub token as the Kitchen secret <strong>GITHUB_TOKEN</strong>, with coding agent access turned off. Grant only the repositories and read permissions needed.</p>
	<button type="button" onclick={() => load()} disabled={busy} class="rounded border px-2 py-1 disabled:opacity-50">Browse repositories</button>
	{#if repositories}
		<label class="block">Repository
			<select class="w-full rounded border p-1" bind:value={selected} onchange={() => { branches = null; branch = ''; if (selected) load(selected); }}>
				<option value="">Choose a repository</option>
				{#each repositories as repo (repo.fullName)}<option value={repo.fullName}>{repo.fullName}{repo.private ? ' (private)' : ''}</option>{/each}
			</select>
		</label>
	{/if}
	{#if branches}
		<label class="block">Branch
			<select class="w-full rounded border p-1" bind:value={branch}>
				<option value="">Choose a branch</option>
				{#each branches as item (item.name)}<option value={item.name}>{item.name}</option>{/each}
			</select>
		</label>
		<button type="button" onclick={importContent} disabled={busy || !branch} class="rounded border px-2 py-1 disabled:opacity-50">Import a copy</button>
	{/if}
	{#if more}<p>Only the first 100 results are shown.</p>{/if}
	{#if message}<p class="text-red-600">{message}</p>{/if}
	{#if imported}<p>{imported}</p>{/if}
	<p>Import copies files into a new folder. It does not create a Git checkout or support Git history, syncing, pushing, or pull requests. Source snapshots exclude environment files and other secret-bearing paths; those files will not survive sandbox replacement.</p>
</div>
