<script lang="ts">
	import BrowserChrome from '$lib/components/BrowserChrome.svelte';
</script>

<div class="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-12">
	<BrowserChrome url="maps-alternative.vibe.kitchen">
		<div class="flex flex-col items-center gap-4 p-10 text-center">
			<p class="text-4xl">💥</p>
			<h1 class="text-lg font-semibold text-stone-900">Application error</h1>
			<p class="max-w-sm text-sm text-stone-500">
				A dependency this Worker relies on tried to use a Node.js API that isn't available in
				this runtime.
			</p>
			<pre
				class="w-full overflow-x-auto rounded-md bg-stone-900 p-3 text-left font-mono text-xs text-red-300">TypeError: fs.readFileSync is not a function
    at loadTileCache (map-tiles.js:14:19)
    at MapView (map-view.js:8:22)</pre>
			<a
				href="/fix"
				data-testid="back-to-platform"
				class="mt-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
			>
				← Back to the Vibe Coding Platform
			</a>
		</div>
	</BrowserChrome>
</div>
