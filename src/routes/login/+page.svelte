<script lang="ts">
	import { page } from '$app/state';
	import BrowserChrome from '$lib/components/BrowserChrome.svelte';
	import { kitchenName } from '$lib/data/chefs';

	const personas = {
		alexandra: { name: 'Alexandra', dest: '/chat' },
		maurice: { name: 'Maurice', dest: '/dashboard' }
	} as const;

	let personaKey = $derived(
		(page.url.searchParams.get('as') as keyof typeof personas) ?? 'alexandra'
	);
	let persona = $derived(personas[personaKey] ?? personas.alexandra);
</script>

<div class="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
	<BrowserChrome url="maurices-non-technical-friends.vibe.kitchen/login">
		<div class="p-8">
			<p class="mb-1 text-2xl">🍳</p>
			<h1 class="mb-1 text-lg font-semibold text-stone-900">{kitchenName}</h1>
			<p class="mb-6 text-sm text-stone-500">Log in to your kitchen</p>

			<label class="mb-4 block">
				<span class="mb-1 block text-xs font-medium text-stone-600">Name</span>
				<input
					type="text"
					value={persona.name}
					readonly
					class="w-full rounded-md border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-800"
				/>
			</label>
			<label class="mb-6 block">
				<span class="mb-1 block text-xs font-medium text-stone-600">Password</span>
				<input
					type="password"
					value="••••••••"
					readonly
					class="w-full rounded-md border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-800"
				/>
			</label>

			<a
				href={persona.dest}
				class="block w-full rounded-md bg-amber-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-amber-700"
			>
				Log in as {persona.name}
			</a>
		</div>
	</BrowserChrome>
</div>
