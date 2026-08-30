<script lang="ts">
	import { kitchenName } from '$lib/data/chefs';

	let { name, role, logoutHref = '/login' }: { name: string; role: string; logoutHref?: string } =
		$props();
</script>

<header class="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-3">
	<div class="flex items-center gap-3">
		<span class="text-xl">🍳</span>
		<div>
			<p class="text-sm font-semibold text-stone-900">{kitchenName}</p>
			<p class="text-xs text-stone-500">vibe.kitchen</p>
		</div>
	</div>
	<div class="flex items-center gap-4">
		<div class="text-right">
			<p class="text-sm font-medium text-stone-900">{name}</p>
			<p class="text-xs text-stone-500">{role}</p>
		</div>
		<a
			href={logoutHref}
			class="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100"
		>
			Log out
		</a>
	</div>
</header>
