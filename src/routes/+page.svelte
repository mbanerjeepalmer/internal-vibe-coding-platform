<script lang="ts">
	import BrowserChrome from '$lib/components/BrowserChrome.svelte';
</script>

<div class="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-12">
	<BrowserChrome url="mail.example.com/inbox">
		<div class="p-6">
			<p class="mb-4 text-xs font-medium tracking-wide text-stone-400 uppercase">Inbox · 1 unread</p>
			<div class="rounded-xl border border-amber-200 bg-amber-50 p-5">
				<div class="mb-3 flex items-center gap-3">
					<div
						class="flex h-9 w-9 items-center justify-center rounded-full bg-amber-600 text-sm font-semibold text-white"
					>
						M
					</div>
					<div>
						<p class="text-sm font-semibold text-stone-900">Maurice</p>
						<p class="text-xs text-stone-500">to Alexandra</p>
					</div>
				</div>
				<p class="mb-1 text-base font-semibold text-stone-900">
					🍳 Maurice has invited you to his vibe coding platform
				</p>
				<p class="mb-4 text-sm text-stone-600">
					Hey Alexandra — I've set you up as a chef in my kitchen, "{'Maurice’s non-technical friends'}".
					You can just describe what you want to build and it'll build it for you. Give it a go?
				</p>
				<a
					href="/login?as=alexandra"
					class="inline-block rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
				>
					Accept invitation
				</a>
			</div>
		</div>
	</BrowserChrome>
</div>
