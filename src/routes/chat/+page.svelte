<script lang="ts">
	import TopBar from '$lib/components/TopBar.svelte';
	import ChatMessage from '$lib/components/ChatMessage.svelte';

	let stage = $state(0);
	let apiKey = $state('');
	let feedbackSent = $state(false);
	let mobilePreview = $state(false);

	function next() {
		stage += 1;
	}

	function sendFeedback() {
		feedbackSent = true;
	}
</script>

<div class="flex min-h-screen flex-col">
	<TopBar name="Alexandra" role="Chef" />

	<div class="flex flex-1 flex-col md:flex-row">
		<!-- Chat pane -->
		<section class="flex w-full flex-col gap-4 border-stone-200 p-6 md:w-1/2 md:border-r">
			<ChatMessage role="agent">
				Hi Alexandra! Drop in whatever spec you've got and I'll get started.
			</ChatMessage>

			{#if stage === 0}
				<button
					type="button"
					data-testid="attach-file"
					onclick={next}
					class="flex w-fit items-center gap-2 rounded-md border border-dashed border-amber-400 bg-amber-50 px-4 py-2 text-sm text-amber-800 hover:bg-amber-100"
				>
					📎 Attach voice_notes_from_whatsapp.mp4
				</button>
			{/if}

			{#if stage >= 1}
				<ChatMessage role="user">
					<p class="mb-1 text-xs opacity-80">📎 voice_notes_from_whatsapp.mp4 (0:47)</p>
					<p>
						"...ok so I want something like Google Maps but way simpler, just for me and my
						friends to share where we are and cool spots..."
					</p>
				</ChatMessage>
			{/if}

			{#if stage === 1}
				<button
					type="button"
					data-testid="send-spec"
					onclick={next}
					class="w-fit rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
				>
					Send
				</button>
			{/if}

			{#if stage >= 2}
				<ChatMessage role="agent">
					<p class="mb-2">Got it — sounds like a Google Maps alternative. Two quick questions:</p>
					<p class="mb-1">1. Just you and friends, or public sign-ups too?</p>
					<p>2. Do you need turn-by-turn directions, or just pins and sharing?</p>
				</ChatMessage>
			{/if}

			{#if stage === 2}
				<button
					type="button"
					data-testid="answer-questions"
					onclick={next}
					class="w-fit rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
				>
					Just friends for now · pins and sharing, no directions
				</button>
			{/if}

			{#if stage >= 3}
				<ChatMessage role="user">Just friends for now · pins and sharing, no directions</ChatMessage>
				<ChatMessage role="agent">
					Perfect, building now. One more thing — I'll need a Google Maps API key to render the
					map.
				</ChatMessage>
			{/if}

			{#if stage === 3}
				<div class="flex w-fit flex-col gap-2 rounded-md border border-stone-200 bg-white p-3">
					<input
						type="text"
						bind:value={apiKey}
						placeholder="Paste your Google Maps API key"
						data-testid="api-key-input"
						class="rounded-md border border-stone-300 px-3 py-2 text-sm"
					/>
					<button
						type="button"
						data-testid="submit-api-key"
						onclick={next}
						class="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
					>
						Continue
					</button>
				</div>
			{/if}

			{#if stage >= 4}
				<ChatMessage role="user">AIzaSy••••••••••••••••••••1234</ChatMessage>
				<ChatMessage role="agent">
					<div class="space-y-1 rounded-md bg-stone-900 p-3 font-mono text-xs text-stone-100">
						<p class="text-red-400">✗ MapView renders markers</p>
						<p class="text-green-400">✓ MapView renders markers</p>
						<p class="text-red-400">✗ Route search returns pins nearby</p>
						<p class="text-green-400">✓ Route search returns pins nearby</p>
						<p class="text-stone-400">
							12/12 tests passing · pyramid: 8 unit · 3 integration · 1 e2e (Playwright)
						</p>
					</div>
					<p class="mt-2">
						Built it — you can try it in the preview. Want to deploy to Cloudflare when you're
						happy?
					</p>
				</ChatMessage>

				<div class="flex flex-col gap-2 rounded-md border border-stone-200 bg-white p-3">
					{#if !feedbackSent}
						<p class="text-xs font-medium text-stone-500">Give feedback on the preview</p>
						<div class="flex gap-2">
							<input
								type="text"
								value="Add an emoji feature"
								readonly
								data-testid="feedback-input"
								class="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm"
							/>
							<button
								type="button"
								data-testid="send-feedback"
								onclick={sendFeedback}
								class="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
							>
								Send
							</button>
						</div>
					{:else}
						<ChatMessage role="user">Add an emoji feature</ChatMessage>
						<ChatMessage role="agent">Done — you can pin an emoji to any spot now. ✅</ChatMessage>
					{/if}
				</div>

				<a
					href="/deployed"
					data-testid="deploy-button"
					class="w-fit rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
				>
					🚀 Deploy to Cloudflare
				</a>
			{/if}
		</section>

		<!-- Preview pane -->
		<section class="flex w-full flex-col items-center gap-3 bg-stone-100 p-6 md:w-1/2">
			{#if stage >= 4}
				<div class="flex w-full max-w-sm items-center justify-between text-xs text-stone-500">
					<span data-testid="preview-url">http://localhost:5173 (dev preview)</span>
					<button
						type="button"
						onclick={() => (mobilePreview = !mobilePreview)}
						class="rounded-md border border-stone-300 bg-white px-2 py-1 hover:bg-stone-50"
					>
						{mobilePreview ? '📱 Mobile' : '🖥️ Desktop'}
					</button>
				</div>
				<div
					class="overflow-hidden rounded-2xl border border-stone-300 bg-gradient-to-br from-emerald-100 via-teal-50 to-sky-100 shadow-sm transition-all"
					style="width: {mobilePreview ? '240px' : '100%'}; max-width: 360px; aspect-ratio: {mobilePreview
						? '9/16'
						: '4/3'};"
					data-testid="app-preview"
				>
					<div class="flex h-full flex-col p-4">
						<p class="mb-2 text-sm font-semibold text-stone-700">Wherever</p>
						<div class="relative flex-1 rounded-lg bg-white/40">
							<span class="absolute top-6 left-8 text-lg">📍</span>
							<span class="absolute top-16 left-1/2 text-lg">📍</span>
							<span class="absolute bottom-8 left-12 text-lg">📍</span>
							{#if feedbackSent}
								<span class="absolute right-8 bottom-10 text-lg" data-testid="emoji-pin">🎉</span>
							{/if}
						</div>
					</div>
				</div>
			{:else}
				<p class="mt-16 text-sm text-stone-400">Preview will appear once the build starts.</p>
			{/if}
		</section>
	</div>
</div>
