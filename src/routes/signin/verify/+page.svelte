<script lang="ts">
	import { page } from '$app/state';

	// This page exists so the token-consuming verify link is never the one
	// emailed to the user directly — see the comment in
	// src/lib/server/auth.ts's sendMagicLink for why. Nothing here should
	// auto-navigate: the link below must only be followed by a real click.
	let token = $derived(page.url.searchParams.get('token') ?? '');
	let callbackURL = $derived(page.url.searchParams.get('callbackURL') ?? '/home');

	let verifyUrl = $derived.by(() => {
		const url = new URL('/api/auth/magic-link/verify', page.url.origin);
		url.searchParams.set('token', token);
		url.searchParams.set('callbackURL', callbackURL);
		return url.toString();
	});
</script>

<div class="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-12">
	<div class="rounded-xl border border-stone-200 bg-white p-8 text-center shadow-sm">
		<p class="mb-1 text-2xl">🍳</p>
		<h1 class="mb-1 text-lg font-semibold text-stone-900">Vibe Kitchen</h1>
		{#if token}
			<p class="mb-6 text-sm text-stone-500">
				For security, this link only signs you in once you click it yourself.
			</p>
			<a
				href={verifyUrl}
				class="block w-full rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
			>
				Finish signing in
			</a>
		{:else}
			<p class="text-sm text-red-600">
				This sign-in link is missing its token. Please request a new one.
			</p>
		{/if}
	</div>
</div>
