<script lang="ts">
	import { page } from '$app/state';
	import { authClient } from '$lib/auth-client';

	let email = $state('');
	let status = $state<'idle' | 'sending' | 'sent' | 'error'>('idle');
	let errorMessage = $state('');

	let next = $derived(page.url.searchParams.get('next') ?? '/home');
	let prefillLocked = $derived(page.url.searchParams.get('lock') === '1');

	$effect(() => {
		const prefill = page.url.searchParams.get('email');
		if (prefill) email = prefill;
	});

	async function submit(e: Event) {
		e.preventDefault();
		status = 'sending';
		errorMessage = '';
		const { error } = await authClient.signIn.magicLink({
			email: email.trim(),
			callbackURL: next
		});
		if (error) {
			status = 'error';
			errorMessage = error.message ?? 'Could not send the sign-in link.';
			return;
		}
		status = 'sent';
	}
</script>

<div class="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-12">
	<div class="rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
		<p class="mb-1 text-2xl">🍳</p>
		<h1 class="mb-1 text-lg font-semibold text-stone-900">Vibe Kitchen</h1>

		{#if status === 'sent'}
			<p class="text-sm text-stone-600">
				Check <strong>{email}</strong> for a sign-in link. It expires in 15 minutes.
			</p>
		{:else}
			<p class="mb-6 text-sm text-stone-500">Sign in with a magic link — no password needed.</p>
			<form onsubmit={submit} class="flex flex-col gap-4">
				<label class="block">
					<span class="mb-1 block text-xs font-medium text-stone-600">Email</span>
					<input
						type="email"
						required
						readonly={prefillLocked}
						bind:value={email}
						placeholder="you@example.com"
						class="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-800 read-only:bg-stone-50"
					/>
				</label>
				{#if errorMessage}
					<p class="text-xs text-red-600">{errorMessage}</p>
				{/if}
				<button
					type="submit"
					disabled={status === 'sending'}
					class="w-full rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
				>
					{status === 'sending' ? 'Sending…' : 'Send sign-in link'}
				</button>
			</form>
		{/if}
	</div>
</div>
