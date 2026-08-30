<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let invitation = $derived(data.invitation);
	let expired = $derived(invitation ? new Date(invitation.expiresAt).getTime() < Date.now() : false);
	let unusable = $derived(!invitation || invitation.revokedAt || invitation.acceptedAt || expired);
	let signedInAsWrongEmail = $derived(
		data.user && invitation && data.user.email.toLowerCase() !== invitation.email.toLowerCase()
	);
</script>

<div class="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-12">
	<div class="rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
		<p class="mb-1 text-2xl">🍳</p>
		<h1 class="mb-1 text-lg font-semibold text-stone-900">Vibe Kitchen invitation</h1>

		{#if !invitation}
			<p class="text-sm text-stone-600">This invitation link is invalid.</p>
		{:else if invitation.revokedAt}
			<p class="text-sm text-stone-600">This invitation has been revoked.</p>
		{:else if invitation.acceptedAt}
			<p class="text-sm text-stone-600">This invitation has already been accepted.</p>
			<a href="/home" class="mt-4 inline-block text-sm font-medium text-amber-700 hover:underline">
				Go to your dashboard
			</a>
		{:else if expired}
			<p class="text-sm text-stone-600">This invitation has expired. Ask for a new one.</p>
		{:else}
			<p class="mb-6 text-sm text-stone-600">
				You're invited to join
				<strong
					>{invitation.kitchenName
						? `the "${invitation.kitchenName}" Kitchen in ${invitation.organisationName}`
						: invitation.organisationName}</strong
				>
				as {invitation.kitchenRole ? invitation.kitchenRole.replace('_', ' ') : 'a member'}.
			</p>

			{#if form?.message}
				<p class="mb-4 text-xs text-red-600">{form.message}</p>
			{/if}

			{#if signedInAsWrongEmail}
				<p class="text-sm text-stone-600">
					You're signed in as {data.user?.email}, but this invitation was sent to
					{invitation.email}. Sign out and sign in with that address to accept it.
				</p>
			{:else if data.user}
				<form method="POST" action="?/accept" use:enhance>
					<button
						type="submit"
						class="w-full rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
					>
						Accept invitation
					</button>
				</form>
			{:else}
				<a
					href={`/signin?email=${encodeURIComponent(invitation.email)}&lock=1&next=${encodeURIComponent(page.url.pathname)}`}
					class="block w-full rounded-md bg-amber-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-amber-700"
				>
					Sign in to accept
				</a>
			{/if}
		{/if}
	</div>
</div>
