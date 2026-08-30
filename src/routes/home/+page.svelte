<script lang="ts">
	import { enhance } from '$app/forms';
	import { authClient } from '$lib/auth-client';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let showCreateKitchen = $state(false);
	let inviteKitchenId = $state<string>('');
	let newAppKitchenId = $state<string>('');

	async function signOut() {
		await authClient.signOut();
		window.location.href = '/signin';
	}
</script>

<div class="min-h-screen bg-stone-50">
	<header class="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-3">
		<div class="flex items-center gap-3">
			<span class="text-xl">🍳</span>
			<div>
				<p class="text-sm font-semibold text-stone-900">{data.organisation.name}</p>
				<p class="text-xs text-stone-500">vibe.kitchen</p>
			</div>
		</div>
		<div class="flex items-center gap-4">
			<div class="text-right">
				<a href={`/users/${data.user.id}`} class="text-sm font-medium text-stone-900 hover:underline">
					{data.user.name || data.user.email}
				</a>
				<p class="text-xs text-stone-500">{data.role === 'owner' ? 'Organisation owner' : 'Member'}</p>
			</div>
			<a
				href="/account"
				class="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100"
			>
				Account settings
			</a>
			<button
				type="button"
				onclick={signOut}
				class="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100"
			>
				Sign out
			</button>
		</div>
	</header>

	<div class="mx-auto flex max-w-3xl flex-col gap-8 p-6">
		{#if form?.message}
			<p class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
				{form.message}
			</p>
		{/if}

		<section>
			<div class="mb-3 flex items-center justify-between">
				<h1 class="text-sm font-semibold text-stone-900">Kitchens</h1>
				{#if data.role === 'owner'}
					<button
						type="button"
						onclick={() => (showCreateKitchen = !showCreateKitchen)}
						class="text-xs font-medium text-amber-700 hover:underline"
					>
						{showCreateKitchen ? 'Cancel' : '+ New Kitchen'}
					</button>
				{/if}
			</div>

			{#if showCreateKitchen}
				<form
					method="POST"
					action="?/createKitchen"
					use:enhance={() => async ({ update }) => {
						await update();
						showCreateKitchen = false;
					}}
					class="mb-4 flex gap-2 rounded-lg border border-stone-200 bg-white p-3"
				>
					<input type="hidden" name="organisationId" value={data.organisation.id} />
					<input
						name="name"
						required
						placeholder="Kitchen name"
						class="flex-1 rounded-md border border-stone-300 px-3 py-1.5 text-sm"
					/>
					<button
						type="submit"
						class="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
					>
						Create
					</button>
				</form>
			{/if}

			{#if data.kitchens.length === 0}
				<p class="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
					You haven't been invited to a working Kitchen yet.
				</p>
			{:else}
				<ul class="flex flex-col gap-2">
					{#each data.kitchens as kitchen (kitchen.id)}
						<li class="rounded-lg border border-stone-200 bg-white p-4">
							<div class="flex items-center justify-between">
								<div>
									<a
										href={`/kitchens/${kitchen.id}`}
										class="text-sm font-semibold text-stone-900 hover:underline"
									>
										{kitchen.name}
									</a>
									<p class="text-xs text-stone-500">
										{kitchen.headChefName ? `Head Chef: ${kitchen.headChefName} · ` : ''}
										{kitchen.memberCount}
										{kitchen.memberCount === 1 ? 'member' : 'members'} · {kitchen.appCount}
										{kitchen.appCount === 1 ? 'app' : 'apps'}
									</p>
								</div>
								<div class="flex shrink-0 gap-3">
									<button
										type="button"
										onclick={() => (newAppKitchenId = newAppKitchenId === kitchen.id ? '' : kitchen.id)}
										class="text-xs font-medium text-amber-700 hover:underline"
									>
										{newAppKitchenId === kitchen.id ? 'Cancel' : '+ New app'}
									</button>
									<button
										type="button"
										onclick={() => (inviteKitchenId = inviteKitchenId === kitchen.id ? '' : kitchen.id)}
										class="text-xs font-medium text-amber-700 hover:underline"
									>
										{inviteKitchenId === kitchen.id ? 'Cancel' : 'Invite a chef'}
									</button>
								</div>
							</div>

							{#if (data.apps[kitchen.id] ?? []).length > 0}
								<ul class="mt-3 flex flex-col gap-1.5 border-t border-stone-100 pt-3">
									{#each data.apps[kitchen.id] as app (app.id)}
										<li>
											<a
												href={`/apps/${app.id}`}
												class="flex items-center justify-between rounded-md px-2 py-1 text-sm text-stone-700 hover:bg-stone-50"
											>
												<span>{app.name}</span>
												<span class="text-xs text-stone-400">{app.sandboxState}</span>
											</a>
										</li>
									{/each}
								</ul>
							{/if}

							{#if newAppKitchenId === kitchen.id}
								<form
									method="POST"
									action="?/createApp"
									use:enhance
									class="mt-3 flex gap-2 border-t border-stone-100 pt-3"
								>
									<input type="hidden" name="kitchenId" value={kitchen.id} />
									<input
										name="name"
										required
										placeholder="App name"
										class="flex-1 rounded-md border border-stone-300 px-3 py-1.5 text-sm"
									/>
									<button
										type="submit"
										class="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
									>
										Create
									</button>
								</form>
							{/if}

							{#if inviteKitchenId === kitchen.id}
								<form
									method="POST"
									action="?/invite"
									use:enhance={() => async ({ update }) => {
										await update();
										inviteKitchenId = '';
									}}
									class="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3"
								>
									<input type="hidden" name="organisationId" value={data.organisation.id} />
									<input type="hidden" name="organisationName" value={data.organisation.name} />
									<input type="hidden" name="kitchenId" value={kitchen.id} />
									<input type="hidden" name="kitchenName" value={kitchen.name} />
									<input
										type="email"
										name="email"
										required
										placeholder="chef@example.com"
										class="min-w-0 flex-1 rounded-md border border-stone-300 px-3 py-1.5 text-sm"
									/>
									<select
										name="kitchenRole"
										class="rounded-md border border-stone-300 px-2 py-1.5 text-sm"
									>
										<option value="chef">Chef</option>
										<option value="head_chef">Head Chef</option>
									</select>
									<button
										type="submit"
										class="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
									>
										Send invite
									</button>
								</form>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		{#if data.role === 'owner'}
			<section>
				<h2 class="mb-3 text-sm font-semibold text-stone-900">Pending invitations</h2>
				{#if data.pendingInvitations.length === 0}
					<p class="text-sm text-stone-500">No pending invitations.</p>
				{:else}
					<ul class="flex flex-col gap-2">
						{#each data.pendingInvitations as invitation (invitation.id)}
							<li
								class="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-4 py-2.5"
							>
								<div>
									<p class="text-sm text-stone-900">{invitation.email}</p>
									<p class="text-xs text-stone-500">
										{invitation.kitchenName
											? `${invitation.kitchenRole} in ${invitation.kitchenName}`
											: 'Organisation member'}
										· expires {new Date(invitation.expiresAt).toLocaleDateString()}
									</p>
								</div>
								<form method="POST" action="?/revokeInvitation" use:enhance>
									<input type="hidden" name="invitationId" value={invitation.id} />
									<button type="submit" class="text-xs font-medium text-red-600 hover:underline">
										Revoke
									</button>
								</form>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/if}
	</div>
</div>
