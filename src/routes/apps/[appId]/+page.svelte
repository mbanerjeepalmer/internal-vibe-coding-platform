<script lang="ts">
	import TopBar from '$lib/components/TopBar.svelte';
	import ChatMessage from '$lib/components/ChatMessage.svelte';
	import ToolCall from '$lib/components/ToolCall.svelte';
	import Composer from '$lib/components/Composer.svelte';
	import { OpencodeSession, type PromptFile } from '$lib/opencode/session.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const session = new OpencodeSession(data.app.id);
	let composerValue = $state('');
	let ready = $state(false);
	let initError = $state<string | null>(null);
	let pendingFiles = $state<PromptFile[]>([]);
	let fileInput: HTMLInputElement;
	let destroying = $state(false);
	let storage = $state<{ linked: { databaseId: string; databaseName: string } | null; orphans: Array<{ databaseId: string; databaseName: string }> } | null>(null);
	let storageBusy = $state(false);
	let storageError = $state<string | null>(null);
	let secrets = $state<{ kitchen: Array<{ name: string }>; appSecrets: Array<{ name: string; overridesKitchenSecret?: boolean }> } | null>(null);
	let secretsBusy = $state(false);
	let secretsError = $state<string | null>(null);
	let secretName = $state('');
	let secretValue = $state('');
	let secretScope = $state<'app' | 'kitchen'>('app');
	let requestedSecretValue = $state<Record<string, string>>({});
	let requestedSecretBusy = $state<string | null>(null);
	let requestedSecretError = $state<Record<string, string>>({});

	let panelTab = $state<'timeline' | 'preview'>('timeline');
	let previewPort = $state('5173');
	let previewSrc = $state<string | null>(null);

	$effect(() => {
		session
			.init()
			.then(() => (ready = true))
			.catch((err) => (initError = err instanceof Error ? err.message : String(err)));
		return () => session.dispose();
	});

	function submit(text: string) {
		composerValue = '';
		const files = pendingFiles;
		pendingFiles = [];
		session.sendPrompt(text, files);
	}

	function toolIcon(tool: string) {
		if (tool.includes('read') || tool.includes('list') || tool.includes('grep')) return '🔎';
		if (tool.includes('write') || tool.includes('edit')) return '📝';
		if (tool.includes('bash') || tool.includes('shell')) return '💻';
		return '⚙️';
	}

	async function loadStorage() {
		if (data.app.role !== 'head_chef') return;
		storageBusy = true;
		storageError = null;
		try {
			const response = await fetch(`/api/kitchen/${data.app.id}/storage`);
			if (!response.ok) throw new Error(await response.text());
			storage = await response.json();
		} catch (err) {
			storageError = err instanceof Error ? err.message : String(err);
		} finally {
			storageBusy = false;
		}
	}

	async function storageAction(action: 'unlink' | 'destroy' | 'relink', databaseId?: string) {
		const linked = storage?.linked;
		const confirmation = action === 'destroy' && linked
			? prompt(`This permanently deletes all data. Type DELETE ${linked.databaseName} to continue:`)
			: action === 'unlink' && linked
				? prompt(`This keeps the database and makes it available to relink. Type ${linked.databaseName} to continue:`)
				: '';
		if (confirmation === null) return;
		storageBusy = true;
		storageError = null;
		try {
			const response = await fetch(`/api/kitchen/${data.app.id}/storage`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action, databaseId, confirmation })
			});
			if (!response.ok) throw new Error(await response.text());
			await loadStorage();
		} catch (err) {
			storageError = err instanceof Error ? err.message : String(err);
			storageBusy = false;
		}
	}

	// Attachments go to opencode as a multimodal content part sent straight to
	// the model — they only work with a model whose capabilities cover the
	// attached media type. See docs/01_hardcoded_demo.md's attachment findings.
	function onFilePicked(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			pendingFiles = [
				...pendingFiles,
				{ uri: reader.result as string, mime: file.type || 'application/octet-stream', name: file.name }
			];
		};
		reader.readAsDataURL(file);
		(e.target as HTMLInputElement).value = '';
	}

	function removePendingFile(name: string) {
		pendingFiles = pendingFiles.filter((f) => f.name !== name);
	}

	function openPreview() {
		const port = Number(previewPort);
		if (!Number.isInteger(port) || port <= 0) return;
		previewSrc = `/api/kitchen/${data.app.id}/preview/${port}/`;
		panelTab = 'preview';
	}

	async function destroy() {
		if (!confirm('Destroy this sandbox? This stops (or deletes) it entirely.')) return;
		destroying = true;
		await session.destroySandbox();
		destroying = false;
	}

	async function loadSecrets() {
		secretsBusy = true;
		secretsError = null;
		try {
			const response = await fetch(`/api/kitchen/${data.app.id}/secrets`);
			if (!response.ok) throw new Error(await response.text());
			secrets = await response.json();
		} catch (err) {
			secretsError = err instanceof Error ? err.message : String(err);
		} finally { secretsBusy = false; }
	}

	async function saveSecret() {
		secretsBusy = true;
		secretsError = null;
		try {
			const response = await fetch(`/api/kitchen/${data.app.id}/secrets`, {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ scope: secretScope, name: secretName.trim(), value: secretValue })
			});
			if (!response.ok) throw new Error(await response.text());
			secretName = ''; secretValue = '';
			await loadSecrets();
		} catch (err) { secretsError = err instanceof Error ? err.message : String(err); secretsBusy = false; }
	}

	async function removeSecret(scope: 'app' | 'kitchen', name: string) {
		if (!confirm(`Delete ${name}? New runs will no longer receive it.`)) return;
		secretsBusy = true;
		try {
			const response = await fetch(`/api/kitchen/${data.app.id}/secrets`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope, name }) });
			if (!response.ok) throw new Error(await response.text());
			await loadSecrets();
		} catch (err) { secretsError = err instanceof Error ? err.message : String(err); secretsBusy = false; }
	}

	function secretRequest(item: { input: Record<string, unknown> }) {
		const name = typeof item.input.name === 'string' ? item.input.name : '';
		const reason = typeof item.input.reason === 'string' ? item.input.reason : '';
		return { name, reason, valid: /^[A-Z][A-Z0-9_]{0,127}$/.test(name) };
	}

	async function fulfilSecretRequest(itemId: string, name: string) {
		const value = requestedSecretValue[itemId] ?? '';
		if (!value) return;
		requestedSecretBusy = itemId;
		requestedSecretError = { ...requestedSecretError, [itemId]: '' };
		try {
			const response = await fetch(`/api/kitchen/${data.app.id}/secrets`, {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ scope: 'app', name, value })
			});
			if (!response.ok) throw new Error(await response.text());
			requestedSecretValue = { ...requestedSecretValue, [itemId]: '' };
			await session.sendPrompt(`The user securely added ${name}. It will be available to new runs and deploys by that environment-variable name; never ask for or print its value.`);
		} catch (err) {
			requestedSecretError = { ...requestedSecretError, [itemId]: err instanceof Error ? err.message : String(err) };
		} finally { requestedSecretBusy = null; }
	}
</script>

<div class="flex h-screen flex-col overflow-hidden">
	<TopBar
		kitchenName={data.app.kitchenName}
		name={data.user.name || data.user.email}
		role={data.app.role === 'head_chef' ? 'Head Chef' : 'Chef'}
	/>

	<div class="flex flex-1 overflow-hidden">
		<aside class="hidden w-56 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-slate-50/60 p-3 md:flex">
			<p class="mb-2 px-2 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
				App
			</p>
			<div class="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2 text-sm shadow-sm">
				<span
					class="h-1.5 w-1.5 shrink-0 rounded-full {session.busy ? 'bg-blue-500' : 'bg-emerald-500'}"
				></span>
				<span class="truncate text-slate-700">{data.app.name}</span>
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

			<div class="mt-2 space-y-2 pt-2">
				<button
					type="button"
					onclick={loadSecrets}
					disabled={secretsBusy}
					class="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
				>
					🔐 App secrets
					<span class="mt-0.5 block font-normal text-slate-500">Add or rotate this App’s credentials</span>
				</button>
				{#if secrets}
					<div class="space-y-2 rounded-md border border-slate-200 bg-white p-2 text-[11px] text-slate-600">
						<p>Values are write-only and never shown again.</p>
						<div class="space-y-1">
							<p class="font-medium">App secrets</p>
							{#each secrets.appSecrets as secret (secret.name)}
								<div class="flex justify-between gap-1"><span class="truncate">{secret.name}{secret.overridesKitchenSecret ? ' (overrides Kitchen)' : ''}</span><button type="button" onclick={() => removeSecret('app', secret.name)} class="text-red-700 underline">Delete</button></div>
							{/each}
							{#if !secrets.appSecrets.length}<p>None yet.</p>{/if}
						</div>
						<div class="space-y-1"><p class="font-medium">Kitchen secrets inherited by this App</p>{#each secrets.kitchen as secret (secret.name)}<div class="flex justify-between gap-1"><span class="truncate">{secret.name}</span>{#if data.app.role === 'head_chef'}<button type="button" onclick={() => removeSecret('kitchen', secret.name)} class="text-red-700 underline">Delete</button>{/if}</div>{/each}{#if !secrets.kitchen.length}<p>None yet.</p>{/if}</div>
						<form class="space-y-1" onsubmit={(event) => { event.preventDefault(); saveSecret(); }}>
							{#if data.app.role === 'head_chef'}<select bind:value={secretScope} class="w-full rounded border border-slate-200 px-1 py-1"><option value="app">This App</option><option value="kitchen">Kitchen (shared)</option></select>{/if}
							<input bind:value={secretName} placeholder="GOOGLE_MAPS_API_KEY" class="w-full rounded border border-slate-200 px-1 py-1" />
							<input bind:value={secretValue} type="password" autocomplete="off" placeholder="Paste value (write-only)" class="w-full rounded border border-slate-200 px-1 py-1" />
							<button disabled={secretsBusy} class="w-full rounded bg-slate-800 px-2 py-1 text-white">Save {secretScope === 'kitchen' ? 'Kitchen' : 'App'} secret</button>
						</form>
					</div>
				{/if}
				{#if secretsError}<p class="text-[11px] text-red-600">{secretsError}</p>{/if}
				{#if data.app.role === 'head_chef'}
					<button
						type="button"
						onclick={loadStorage}
						disabled={storageBusy}
						class="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
					>
						🗄️ {storage ? 'Refresh storage' : 'Manage storage'}
					</button>
					{#if storage}
						<div class="space-y-1 rounded-md border border-slate-200 bg-white p-2 text-[11px] text-slate-600">
							{#if storage.linked}
								<p class="break-all font-medium">Linked: {storage.linked.databaseName}</p>
								<button type="button" onclick={() => storageAction('unlink')} disabled={storageBusy} class="mr-2 text-amber-700 underline">Unlink (keep data)</button>
								<button type="button" onclick={() => storageAction('destroy')} disabled={storageBusy} class="text-red-700 underline">Permanently delete</button>
							{:else}
								<p>No database linked. Deploy creates a new one.</p>
							{/if}
							{#if storage.orphans.length}
								<p class="mt-2 font-medium">Unlinked Vibe databases</p>
								{#each storage.orphans as orphan (orphan.databaseId)}
									<div class="flex items-center justify-between gap-1"><span class="truncate">{orphan.databaseName}</span><button type="button" onclick={() => storageAction('relink', orphan.databaseId)} disabled={storageBusy || !!storage.linked} class="text-blue-700 underline">Relink</button></div>
								{/each}
							{/if}
						</div>
					{/if}
					{#if storageError}<p class="text-[11px] text-red-600">{storageError}</p>{/if}
				{/if}

				<button
					type="button"
					data-testid="deploy-project"
					onclick={() => session.deploy()}
					disabled={session.deploying || session.destroyed}
					class="w-full rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
				>
					{session.deploying && session.deployResult?.action !== 'undeploy'
						? 'Deploying…'
						: '🚀 Deploy to Cloudflare'}
				</button>

				{#if session.deployed}
					<button
						type="button"
						data-testid="undeploy-project"
						onclick={() => session.undeploy()}
						disabled={session.deploying || session.destroyed}
						class="w-full rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
					>
						{session.deploying && session.deployResult?.action === 'undeploy'
							? 'Tearing down…'
							: '⏏️ Tear down deployed worker'}
					</button>
				{/if}

				{#if session.deployResult}
					<div
						data-testid="deploy-result"
						class="rounded-md border px-2.5 py-2 text-xs {session.deployResult.success
							? 'border-emerald-200 bg-emerald-50 text-emerald-800'
							: 'border-red-200 bg-red-50 text-red-700'}"
					>
						{#if session.deployResult.action === 'undeploy'}
							{#if session.deployResult.success}
								<p>Worker torn down.</p>
							{:else}
								<p class="mb-1 font-medium">Teardown failed</p>
								<pre class="max-h-32 overflow-y-auto whitespace-pre-wrap">{session.deployResult.log}</pre>
							{/if}
						{:else if session.deployResult.success && session.deployResult.url}
							<p>
								Live at
								<a
									href={session.deployResult.url}
									target="_blank"
									rel="noreferrer"
									class="font-medium underline"
								>
									{session.deployResult.url}
								</a>
							</p>
						{:else if session.deployResult.success}
							<p>Deployed, but couldn't find the worker URL in the log.</p>
						{:else}
							<p class="mb-1 font-medium">Deploy failed</p>
							<pre class="max-h-32 overflow-y-auto whitespace-pre-wrap">{session.deployResult.log}</pre>
						{/if}
					</div>
				{/if}

				<button
					type="button"
					data-testid="destroy-sandbox"
					onclick={destroy}
					disabled={destroying || session.destroyed}
					class="w-full rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
				>
					{session.destroyed ? 'Sandbox destroyed' : destroying ? 'Destroying…' : '🗑️ Destroy sandbox'}
				</button>
			</div>
		</aside>

		<section class="flex min-w-0 flex-1 flex-col md:w-1/2">
			<div class="flex items-center gap-1 border-b border-slate-200 bg-white px-3 pt-2 md:hidden">
				<button
					type="button"
					onclick={() => (panelTab = 'timeline')}
					class="rounded-t-md border-b-2 px-3 py-1.5 text-xs font-medium {panelTab === 'timeline'
						? 'border-blue-600 text-blue-700'
						: 'border-transparent text-slate-500'}">Chat</button
				>
				<button
					type="button"
					onclick={() => (panelTab = 'preview')}
					class="rounded-t-md border-b-2 px-3 py-1.5 text-xs font-medium {panelTab === 'preview'
						? 'border-blue-600 text-blue-700'
						: 'border-transparent text-slate-500'}">Preview</button
				>
			</div>

			<div
				class="flex-1 space-y-5 overflow-y-auto p-6 {panelTab === 'preview' ? 'hidden md:block' : ''}"
				data-testid="live-timeline"
			>
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
						{#if item.tool === 'request_secret' && secretRequest(item).valid}
							{@const request = secretRequest(item)}
							<div class="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm" data-testid="secret-request">
								<p class="font-medium text-blue-950">The agent needs {request.name}</p>
								{#if request.reason}<p class="mt-1 text-xs text-blue-800">{request.reason}</p>{/if}
								<form class="mt-3 space-y-2" onsubmit={(event) => { event.preventDefault(); fulfilSecretRequest(item.id, request.name); }}>
									<input bind:value={requestedSecretValue[item.id]} type="password" autocomplete="off" placeholder="Paste value securely" class="w-full rounded border border-blue-200 bg-white px-2 py-1.5 text-xs" />
									<button disabled={requestedSecretBusy === item.id} class="rounded bg-blue-700 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50">{requestedSecretBusy === item.id ? 'Saving…' : `Add ${request.name}`}</button>
								</form>
								<p class="mt-2 text-[11px] text-blue-700">Write-only: the value is never shown to the agent or returned here.</p>
								{#if requestedSecretError[item.id]}<p class="mt-1 text-xs text-red-600">{requestedSecretError[item.id]}</p>{/if}
							</div>
						{:else}
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
						{/if}
					{:else if item.kind === 'error'}
						<ChatMessage role="agent">
							<p class="text-red-600">⚠️ {item.message}</p>
						</ChatMessage>
					{/if}
				{/each}

				{#each session.pendingPermissions as perm (perm.id)}
					<div
						class="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm"
						data-testid="permission-request"
					>
						<p class="mb-1 font-medium text-amber-900">Agent wants to: {perm.action}</p>
						{#if perm.resources.length}
							<p class="mb-2 truncate text-xs text-amber-700">{perm.resources.join(', ')}</p>
						{/if}
						<div class="flex gap-2">
							<button
								type="button"
								data-testid="permission-allow-once"
								onclick={() => session.replyPermission(perm.id, 'once')}
								class="rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700"
								>Allow once</button
							>
							<button
								type="button"
								onclick={() => session.replyPermission(perm.id, 'always')}
								class="rounded-md border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
								>Always allow</button
							>
							<button
								type="button"
								data-testid="permission-deny"
								onclick={() => session.replyPermission(perm.id, 'reject')}
								class="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
								>Deny</button
							>
						</div>
					</div>
				{/each}
			</div>

			<div class="border-t border-slate-200 bg-white p-4 {panelTab === 'preview' ? 'hidden md:block' : ''}">
				{#if pendingFiles.length > 0}
					<div class="mb-2 flex flex-wrap gap-2">
						{#each pendingFiles as f (f.name)}
							<span
								class="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600"
							>
								📎 {f.name}
								<button type="button" onclick={() => removePendingFile(f.name)} class="text-slate-400 hover:text-slate-700"
									>✕</button
								>
							</span>
						{/each}
					</div>
				{/if}

				<input
					bind:this={fileInput}
					type="file"
					accept="image/*,video/*,audio/*,.pdf"
					class="hidden"
					data-testid="attach-file-input"
					onchange={onFilePicked}
				/>
				<button
					type="button"
					data-testid="attach-file"
					onclick={() => fileInput.click()}
					class="mb-2 flex w-fit items-center gap-2 rounded-md border border-dashed border-blue-300 bg-blue-50 px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-100"
				>
					📎 Attach image/video/audio
				</button>

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

		<section
			class="hidden w-full flex-col border-l border-slate-200 bg-slate-50 md:flex md:w-1/2 {panelTab === 'preview'
				? '!flex'
				: ''}"
		>
			<div class="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
				<span class="text-xs font-medium text-slate-500">Preview port</span>
				<input
					bind:value={previewPort}
					data-testid="preview-port-input"
					class="w-20 rounded border border-slate-300 px-2 py-1 text-xs"
				/>
				<button
					type="button"
					data-testid="open-preview"
					onclick={openPreview}
					class="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800"
					>Open</button
				>
			</div>
			<div class="flex flex-1 items-center justify-center">
				{#if previewSrc}
					<iframe
						src={previewSrc}
						title="Sandbox preview"
						data-testid="preview-frame"
						class="h-full w-full border-0"
					></iframe>
				{:else}
					<p class="text-sm text-slate-400">
						Enter the port the agent's dev server is running on, then Open.
					</p>
				{/if}
			</div>
		</section>
	</div>
</div>
