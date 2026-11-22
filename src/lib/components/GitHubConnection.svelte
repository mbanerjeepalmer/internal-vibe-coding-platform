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
	let repoPage = $state(1);
	let branchPage = $state(1);
	let targetBranch = $state('');
	let prTitle = $state('');
	let prBody = $state('');
	let pullRequest = $state<{ url: string; number: number } | null>(null);
	async function createPullRequest() {
		busy = true; message = ''; pullRequest = null;
		try {
			const response = await fetch(`/api/kitchen/${appId}/github/pull-request`, {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ repository: selected, head: branch, base: targetBranch, title: prTitle, body: prBody })
			});
			const result = await response.json() as { message?: string; url?: string; number?: number };
			if (!response.ok || !result.url || !result.number) throw new Error(result.message ?? 'Could not create pull request.');
			pullRequest = { url: result.url, number: result.number };
		} catch (error) { message = error instanceof Error ? error.message : 'Could not create pull request.'; }
		finally { busy = false; }
	}
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
	async function load(repository?: string, page = 1) {
		busy = true;
		message = '';
		try {
			const query = `?page=${page}${repository ? `&repository=${encodeURIComponent(repository)}` : ''}`;
			const response = await fetch(`/api/kitchen/${appId}/github${query}`);
			const result = await response.json() as { message?: string; repositories?: Array<{ fullName: string; private: boolean; defaultBranch: string }>; branches?: Array<{ name: string }>; hasMore?: boolean };
			if (!response.ok) throw new Error(result.message ?? 'GitHub request failed.');
			if (repository) { branches = result.branches ?? []; branchPage = page; branch = ''; }
			else { repositories = result.repositories ?? []; branches = null; selected = ''; branch = ''; repoPage = page; }
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
			<select class="w-full rounded border p-1" bind:value={selected} disabled={busy} onchange={() => { branches = null; branch = ''; pullRequest = null; targetBranch = repositories?.find((repo) => repo.fullName === selected)?.defaultBranch ?? ''; if (selected) load(selected); }}>
				<option value="">Choose a repository</option>
				{#each repositories as repo (repo.fullName)}<option value={repo.fullName}>{repo.fullName}{repo.private ? ' (private)' : ''}</option>{/each}
			</select>
		</label>
	{/if}
	{#if branches}
		<label class="block">Branch
			<select class="w-full rounded border p-1" bind:value={branch} disabled={busy}>
				<option value="">Choose a branch</option>
				{#each branches as item (item.name)}<option value={item.name}>{item.name}</option>{/each}
			</select>
		</label>
		<button type="button" onclick={importContent} disabled={busy || !branch} class="rounded border px-2 py-1 disabled:opacity-50">Import a copy</button>
		<details>
			<summary class="cursor-pointer">Open a GitHub pull request</summary>
			<p>Uses the selected branch already on GitHub; local changes are not pushed. The Kitchen token needs pull request write permission.</p>
			<label class="block">Target branch <input class="w-full rounded border p-1" bind:value={targetBranch} disabled={busy} /></label>
			<label class="block">Title <input class="w-full rounded border p-1" bind:value={prTitle} disabled={busy} maxlength="256" /></label>
			<label class="block">Description <textarea class="w-full rounded border p-1" bind:value={prBody} disabled={busy} maxlength="65536"></textarea></label>
			<button type="button" onclick={createPullRequest} disabled={busy || !branch || !targetBranch || !prTitle.trim()} class="rounded border px-2 py-1 disabled:opacity-50">Create pull request on GitHub</button>
			{#if pullRequest}<p><a href={pullRequest.url} target="_blank" rel="noopener noreferrer" class="underline">View pull request #{pullRequest.number}</a></p>{/if}
		</details>
		<div class="flex items-center gap-2">
			<button type="button" onclick={() => load(selected, branchPage - 1)} disabled={busy || branchPage === 1} class="rounded border px-2 py-1 disabled:opacity-50">Previous branches</button>
			<span>Page {branchPage}</span>
			<button type="button" onclick={() => load(selected, branchPage + 1)} disabled={busy || !more} class="rounded border px-2 py-1 disabled:opacity-50">Next branches</button>
		</div>
	{:else if repositories}
		<div class="flex items-center gap-2">
			<button type="button" onclick={() => load(undefined, repoPage - 1)} disabled={busy || repoPage === 1} class="rounded border px-2 py-1 disabled:opacity-50">Previous repositories</button>
			<span>Page {repoPage}</span>
			<button type="button" onclick={() => load(undefined, repoPage + 1)} disabled={busy || !more} class="rounded border px-2 py-1 disabled:opacity-50">Next repositories</button>
		</div>
	{/if}
	{#if message}<p class="text-red-600">{message}</p>{/if}
	{#if imported}<p>{imported}</p>{/if}
	<p>Import copies files into a new folder. It does not create a Git checkout or support Git history, syncing, or pushing. Pull requests use branches already on GitHub. Source snapshots exclude environment files and other secret-bearing paths; those files will not survive sandbox replacement.</p>
</div>
