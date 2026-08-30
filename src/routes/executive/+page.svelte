<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let sqlForce = $state(false);
	let bashForce = $state(false);
	let grantEmail = $state('');
</script>

<div class="min-h-screen bg-stone-50">
	<header class="border-b border-stone-200 bg-white px-6 py-3">
		<div class="flex items-center gap-3">
			<span class="text-xl">👨‍🍳</span>
			<div>
				<a href="/home" class="text-xs text-stone-500 hover:underline">← Dashboard</a>
				<p class="text-sm font-semibold text-stone-900">Executive Chef console</p>
			</div>
		</div>
	</header>

	<div class="mx-auto flex max-w-3xl flex-col gap-8 p-6">
		{#if form?.message}
			<p class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{form.message}</p>
		{/if}

		<section class="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
			<h2 class="text-base font-semibold text-stone-900">Run SQL</h2>
			<p class="mt-1 text-sm text-stone-600">
				Runs against the whole production control-plane database. One statement, no comments, no PRAGMA/ATTACH.
				A comment is required unless you check "force".
			</p>
			<form method="POST" action="?/runSql" use:enhance class="mt-4 space-y-3">
				<textarea
					name="sql"
					rows="4"
					required
					placeholder="UPDATE apps SET opencode_session_id = NULL WHERE id = '...'"
					class="w-full rounded-md border border-stone-300 p-3 font-mono text-sm text-stone-800"
				></textarea>
				<input
					name="comment"
					placeholder="Why are you running this?"
					class="w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm"
				/>
				<label class="flex items-center gap-2 text-sm text-stone-600">
					<input type="checkbox" name="force" bind:checked={sqlForce} />
					Force (skip the comment requirement — still logged)
				</label>
				<button type="submit" class="rounded-md bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-800">
					Run
				</button>
			</form>
			{#if form?.sqlResult}
				<pre class="mt-3 max-h-64 overflow-auto rounded-md bg-stone-900 p-3 text-xs text-stone-100">{form.sqlResult}</pre>
			{/if}
		</section>

		<section class="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
			<h2 class="text-base font-semibold text-stone-900">Run a shell command</h2>
			<p class="mt-1 text-sm text-stone-600">Runs inside a specific App's own sandbox — any App, any Kitchen.</p>
			<form method="POST" action="?/runBash" use:enhance class="mt-4 space-y-3">
				<input
					name="appId"
					required
					placeholder="App ID"
					class="w-full rounded-md border border-stone-300 px-3 py-1.5 font-mono text-sm"
				/>
				<textarea
					name="command"
					rows="3"
					required
					placeholder="cat /tmp/opencode.log"
					class="w-full rounded-md border border-stone-300 p-3 font-mono text-sm text-stone-800"
				></textarea>
				<input
					name="comment"
					placeholder="Why are you running this?"
					class="w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm"
				/>
				<label class="flex items-center gap-2 text-sm text-stone-600">
					<input type="checkbox" name="force" bind:checked={bashForce} />
					Force (skip the comment requirement — still logged)
				</label>
				<button type="submit" class="rounded-md bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-800">
					Run
				</button>
			</form>
			{#if form?.bashResult}
				<pre class="mt-3 max-h-64 overflow-auto rounded-md bg-stone-900 p-3 text-xs text-stone-100">{form.bashResult}</pre>
			{/if}
		</section>

		<section class="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
			<h2 class="text-base font-semibold text-stone-900">Executive Chefs</h2>
			<ul class="mt-3 flex flex-col gap-2">
				{#each data.admins as admin (admin.id)}
					<li class="flex items-center justify-between rounded-md border border-stone-200 px-3 py-2 text-sm">
						<span>
							{admin.email}
							<span class="text-xs text-stone-400">
								— granted {admin.grantedAt}{admin.grantedByEmail ? ` by ${admin.grantedByEmail}` : ''}
							</span>
						</span>
						{#if admin.id !== data.currentUserId}
							<form method="POST" action="?/revoke" use:enhance>
								<input type="hidden" name="userId" value={admin.id} />
								<button type="submit" class="text-xs font-medium text-red-600 hover:underline">Revoke</button>
							</form>
						{/if}
					</li>
				{/each}
			</ul>
			<form method="POST" action="?/grant" use:enhance class="mt-4 flex gap-2">
				<input
					name="email"
					bind:value={grantEmail}
					placeholder="new-exec@example.com"
					class="flex-1 rounded-md border border-stone-300 px-3 py-1.5 text-sm"
				/>
				<button type="submit" class="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700">
					Grant
				</button>
			</form>
		</section>

		<section class="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
			<h2 class="text-base font-semibold text-stone-900">Recent actions</h2>
			<ul class="mt-3 flex flex-col gap-2">
				{#each data.actions as action (action.id)}
					<li class="rounded-md border border-stone-200 p-3 text-xs">
						<div class="flex items-center justify-between text-stone-500">
							<span>{action.createdAt} · {action.actorEmail} · {action.kind}{action.appId ? ` · app ${action.appId}` : ''}</span>
							<span class={action.status === 'ok' ? 'text-green-700' : 'text-red-700'}>{action.status}</span>
						</div>
						<pre class="mt-1 overflow-auto whitespace-pre-wrap font-mono text-stone-800">{action.command}</pre>
						{#if action.comment}
							<p class="mt-1 text-stone-600">"{action.comment}"</p>
						{:else if action.forced}
							<p class="mt-1 italic text-stone-400">no comment (forced)</p>
						{/if}
					</li>
				{:else}
					<p class="text-sm text-stone-500">No actions yet.</p>
				{/each}
			</ul>
		</section>
	</div>
</div>
