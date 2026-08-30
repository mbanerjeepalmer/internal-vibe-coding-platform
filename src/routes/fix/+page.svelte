<script lang="ts">
	import TopBar from '$lib/components/TopBar.svelte';
	import ChatMessage from '$lib/components/ChatMessage.svelte';

	let sentryViewed = $state(false);
	let posthogViewed = $state(false);
	let fixed = $state(false);

	let bothViewed = $derived(sentryViewed && posthogViewed);
</script>

<div class="flex min-h-screen flex-col">
	<TopBar name="Alexandra" role="Chef" />

	<div class="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
		<ChatMessage role="agent">
			Looks like maps-alternative crashed right after deploy. Let's dig in — check what Sentry and
			PostHog picked up.
		</ChatMessage>

		<div class="flex flex-col gap-3 sm:flex-row">
			<button
				type="button"
				data-testid="open-sentry"
				onclick={() => (sentryViewed = true)}
				class="flex-1 rounded-lg border border-stone-200 bg-white p-4 text-left hover:border-amber-300"
			>
				<p class="mb-1 text-sm font-semibold text-stone-900">🐛 Sentry</p>
				<p class="text-xs text-stone-500">1 new issue since deploy</p>
			</button>
			<button
				type="button"
				data-testid="open-posthog"
				onclick={() => (posthogViewed = true)}
				class="flex-1 rounded-lg border border-stone-200 bg-white p-4 text-left hover:border-amber-300"
			>
				<p class="mb-1 text-sm font-semibold text-stone-900">📈 PostHog</p>
				<p class="text-xs text-stone-500">Error rate spiked to 100% of sessions</p>
			</button>
		</div>

		{#if sentryViewed}
			<div class="rounded-lg border border-stone-200 bg-white p-4" data-testid="sentry-panel">
				<p class="mb-2 text-sm font-semibold text-stone-900">Sentry · TypeError</p>
				<pre class="overflow-x-auto rounded-md bg-stone-900 p-3 font-mono text-xs text-red-300">TypeError: fs.readFileSync is not a function
    at loadTileCache (map-tiles.js:14:19)</pre>
				<p class="mt-2 text-xs text-stone-500">
					Node's `fs` module doesn't exist in the Workers runtime — the tile cache loader needs
					to use `fetch` instead.
				</p>
			</div>
		{/if}

		{#if posthogViewed}
			<div class="rounded-lg border border-stone-200 bg-white p-4" data-testid="posthog-panel">
				<p class="mb-2 text-sm font-semibold text-stone-900">PostHog · Session funnel</p>
				<p class="text-xs text-stone-500">
					Every session since the deploy hits the map view and immediately errors out — 0%
					reach "pins visible".
				</p>
			</div>
		{/if}

		{#if bothViewed && !fixed}
			<button
				type="button"
				data-testid="fix-it"
				onclick={() => (fixed = true)}
				class="w-fit rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
			>
				Fix it
			</button>
		{/if}

		{#if fixed}
			<ChatMessage role="agent">
				<div class="space-y-1 rounded-md bg-stone-900 p-3 font-mono text-xs text-stone-100">
					<p class="text-red-400">✗ loadTileCache uses fetch instead of fs</p>
					<p class="text-green-400">✓ loadTileCache uses fetch instead of fs</p>
					<p class="text-stone-400">13/13 tests passing</p>
				</div>
				<p class="mt-2">Redeployed — maps-alternative.vibe.kitchen is back up. ✅</p>
			</ChatMessage>

			<ChatMessage role="agent">
				A lot of this — the TDD gate, PostHog and Sentry being wired in — came for free. Your
				Kitchen already had it configured. Want to propose adding a check for this specific kind
				of crash too, so it's caught before deploy next time?
			</ChatMessage>

			<a
				href="/config"
				data-testid="view-parent-config"
				class="w-fit rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
			>
				View parent config
			</a>
		{/if}
	</div>
</div>
