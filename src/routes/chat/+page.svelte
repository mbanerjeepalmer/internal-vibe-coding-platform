<script lang="ts">
	import TopBar from '$lib/components/TopBar.svelte';
	import ChatMessage from '$lib/components/ChatMessage.svelte';
	import ToolCall from '$lib/components/ToolCall.svelte';
	import Composer from '$lib/components/Composer.svelte';

	// Stages: 0 nothing attached · 1 attached, unsent · 2 sent, clarifying Qs asked ·
	// 3 answered, API key requested · 4 key submitted, building/built
	let stage = $state(0);
	let composerValue = $state('');
	let feedbackSent = $state(false);
	let mobilePreview = $state(false);
	let panelTab = $state<'preview' | 'terminal'>('preview');

	function attach() {
		stage = 1;
	}

	function sendSpec() {
		stage = 2;
		composerValue = '';
	}

	function answerQuestions() {
		stage = 3;
		composerValue = '';
	}

	function submitApiKey(value: string) {
		if (!value.trim()) return;
		stage = 4;
		composerValue = '';
	}

	function sendFeedback() {
		feedbackSent = true;
	}
</script>

<div class="flex h-screen flex-col overflow-hidden">
	<TopBar name="Alexandra" role="Chef" />

	<div class="flex flex-1 overflow-hidden">
		<!-- Session rail -->
		<aside class="hidden w-56 shrink-0 flex-col border-r border-slate-200 bg-slate-50/60 p-3 md:flex">
			<p class="mb-2 px-2 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
				Sessions
			</p>
			<div class="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2 text-sm shadow-sm">
				<span class="h-1.5 w-1.5 shrink-0 rounded-full {stage >= 4 ? 'bg-emerald-500' : 'bg-blue-500'}"
				></span>
				<span class="truncate text-slate-700">Google Maps alternative</span>
			</div>
		</aside>

		<!-- Timeline + composer -->
		<section class="flex min-w-0 flex-1 flex-col md:w-1/2">
			<div class="flex-1 space-y-5 overflow-y-auto p-6">
				<ChatMessage role="agent">
					Hi Alexandra! Drop in whatever spec you've got and I'll get started.
				</ChatMessage>

				{#if stage >= 2}
					<ChatMessage role="user">
						<p class="mb-1 text-xs opacity-70">🎬 voice_notes_from_whatsapp.mp4 (0:47)</p>
						<p>
							"...ok so I want something like Google Maps but way simpler, just for me and my
							friends to share where we are and cool spots..."
						</p>
					</ChatMessage>
				{/if}

				{#if stage >= 2}
					<ChatMessage role="agent">
						<p class="mb-2">Got it — sounds like a Google Maps alternative. Two quick questions:</p>
						<p class="mb-1">1. Just you and friends, or public sign-ups too?</p>
						<p>2. Do you need turn-by-turn directions, or just pins and sharing?</p>
					</ChatMessage>
				{/if}

				{#if stage >= 3}
					<ChatMessage role="user">Just friends for now · pins and sharing, no directions</ChatMessage>
					<ChatMessage role="agent">
						Perfect, building now. One more thing — I'll need a Google Maps API key to render the
						map.
					</ChatMessage>
				{/if}

				{#if stage >= 4}
					<ChatMessage role="user">AIzaSy••••••••••••••••••••1234</ChatMessage>

					<ToolCall
						icon="🧪"
						status="done"
						activeLabel="Writing tests"
						doneLabel="Wrote and ran 12 tests"
						testId="test-run-tool-call"
					>
						{#snippet children()}
							<div class="space-y-0.5">
								<p class="text-red-500">✗ MapView renders markers</p>
								<p class="text-emerald-600">✓ MapView renders markers</p>
								<p class="text-red-500">✗ Route search returns pins nearby</p>
								<p class="text-emerald-600">✓ Route search returns pins nearby</p>
								<p class="text-slate-400">
									12/12 passing · pyramid: 8 unit · 3 integration · 1 e2e (Playwright)
								</p>
							</div>
						{/snippet}
					</ToolCall>

					<ChatMessage role="agent">
						Built it — you can try it in the preview. Want to deploy to Cloudflare when you're
						happy?
					</ChatMessage>

					{#if feedbackSent}
						<ChatMessage role="user">Add an emoji feature</ChatMessage>
						<ChatMessage role="agent">Done — you can pin an emoji to any spot now. ✅</ChatMessage>
					{/if}
				{/if}
			</div>

			<div class="border-t border-slate-200 bg-white p-4">
				{#if stage === 0}
					<Composer bind:value={composerValue} showAttach={true} onAttach={attach} disabled />
				{:else if stage === 1}
					<Composer
						bind:value={composerValue}
						showAttach={false}
						attachChip="voice_notes_from_whatsapp.mp4"
						submitTestId="send-spec"
						placeholder="Add a note, or just send"
						onSubmit={sendSpec}
					/>
				{:else if stage === 2}
					<Composer
						bind:value={composerValue}
						showAttach={false}
						suggestions={[
							{
								text: 'Just friends for now · pins and sharing, no directions',
								testId: 'answer-questions'
							}
						]}
						placeholder="Or type your own answer"
						onSubmit={answerQuestions}
					/>
				{:else if stage === 3}
					<Composer
						bind:value={composerValue}
						showAttach={false}
						inputTestId="api-key-input"
						submitTestId="submit-api-key"
						placeholder="Paste your Google Maps API key"
						onSubmit={submitApiKey}
					/>
				{:else}
					<Composer
						bind:value={composerValue}
						showAttach={false}
						suggestions={feedbackSent
							? []
							: [{ text: 'Add an emoji feature', testId: 'send-feedback' }]}
						placeholder="Give feedback on the preview, or ask for anything else"
						onSubmit={sendFeedback}
					/>
					<a
						href="/deployed"
						data-testid="deploy-button"
						class="mt-3 flex w-fit items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
					>
						🚀 Deploy to staging
					</a>
				{/if}
			</div>
		</section>

		<!-- Side panel -->
		<section class="hidden w-full flex-col border-l border-slate-200 bg-slate-50 md:flex md:w-1/2">
			{#if stage >= 3}
				<div class="flex items-center gap-1 border-b border-slate-200 bg-white px-3 pt-2">
					<button
						type="button"
						onclick={() => (panelTab = 'preview')}
						class="rounded-t-md border-b-2 px-3 py-1.5 text-xs font-medium {panelTab === 'preview'
							? 'border-blue-600 text-blue-700'
							: 'border-transparent text-slate-500 hover:text-slate-700'}"
					>
						Preview
					</button>
					<button
						type="button"
						onclick={() => (panelTab = 'terminal')}
						class="rounded-t-md border-b-2 px-3 py-1.5 text-xs font-medium {panelTab === 'terminal'
							? 'border-blue-600 text-blue-700'
							: 'border-transparent text-slate-500 hover:text-slate-700'}"
					>
						Terminal
					</button>
				</div>
			{/if}

			<div class="flex flex-1 flex-col items-center justify-center gap-3 p-6">
				{#if stage < 3}
					<p class="text-sm text-slate-400">Preview will appear once the build starts.</p>
				{:else if stage === 3}
					<p class="text-shimmer text-sm font-medium">Setting up project…</p>
				{:else if panelTab === 'terminal'}
					<div class="w-full max-w-md rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-100">
						<p class="text-slate-400">$ npx playwright test</p>
						<p class="text-emerald-400">12 passed (12)</p>
						<p class="text-slate-400">$ npm run build</p>
						<p class="text-emerald-400">✓ build complete</p>
					</div>
				{:else}
					<div class="flex w-full max-w-sm items-center justify-between text-xs text-slate-500">
						<span data-testid="preview-url">http://localhost:8787 (wrangler dev)</span>
						<button
							type="button"
							onclick={() => (mobilePreview = !mobilePreview)}
							class="rounded-md border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50"
						>
							{mobilePreview ? '📱 Mobile' : '🖥️ Desktop'}
						</button>
					</div>
					<div
						class="overflow-hidden rounded-2xl border border-slate-300 bg-gradient-to-br from-emerald-100 via-teal-50 to-sky-100 shadow-sm transition-all"
						style="width: {mobilePreview ? '240px' : '100%'}; max-width: 360px; aspect-ratio: {mobilePreview
							? '9/16'
							: '4/3'};"
						data-testid="app-preview"
					>
						<div class="flex h-full flex-col p-4">
							<p class="mb-2 text-sm font-semibold text-slate-700">Wherever</p>
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
				{/if}
			</div>
		</section>
	</div>
</div>
