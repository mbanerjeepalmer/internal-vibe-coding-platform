<svelte:head>
	<title>Vibe Kitchen</title>
</svelte:head>

<div class="min-h-screen bg-stone-50">
	<header class="flex items-center justify-between px-4 py-4 sm:px-8">
		<div class="flex items-center gap-2">
			<span class="text-xl">🍳</span>
			<span class="text-sm font-semibold text-stone-900">Vibe Kitchen</span>
		</div>
		<a
			href="/signin"
			class="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100"
		>
			Sign in
		</a>
	</header>

	<main class="mx-auto flex max-w-3xl flex-col gap-16 px-4 pt-8 pb-24 sm:px-8">
		<section class="text-center">
			<p class="mb-3 text-4xl">🍳</p>
			<h1 class="text-3xl font-semibold text-stone-900 sm:text-4xl">
				Describe the app you want. We'll cook it up.
			</h1>
			<p class="mx-auto mt-4 max-w-xl text-base text-stone-600">
				Vibe Kitchen is an internal platform where you chat with an AI coding agent in plain
				English, and it writes, runs, and deploys a real web app for you — no coding required.
			</p>
			<a
				href="/signin"
				class="mt-8 inline-block rounded-md bg-amber-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-700"
			>
				Sign in to get started
			</a>
		</section>

		<section class="grid gap-6 sm:grid-cols-3">
			<div class="rounded-lg border border-stone-200 bg-white p-5">
				<p class="mb-2 text-xl">🍽️</p>
				<h2 class="text-sm font-semibold text-stone-900">Kitchens</h2>
				<p class="mt-1 text-sm text-stone-600">
					A Kitchen is your team's shared workspace. Invite teammates, set shared ground rules for
					how the agent should work, and pick from a library of skills it should follow.
				</p>
			</div>
			<div class="rounded-lg border border-stone-200 bg-white p-5">
				<p class="mb-2 text-xl">👨‍🍳</p>
				<h2 class="text-sm font-semibold text-stone-900">Apps</h2>
				<p class="mt-1 text-sm text-stone-600">
					Each idea lives in its own App: a chat with a coding agent that writes real code, lets
					you preview it live, and deploys it to the web with one click.
				</p>
			</div>
			<div class="rounded-lg border border-stone-200 bg-white p-5">
				<p class="mb-2 text-xl">💾</p>
				<h2 class="text-sm font-semibold text-stone-900">Nothing's lost</h2>
				<p class="mt-1 text-sm text-stone-600">
					Every App's code and data are saved automatically, so you can pick a conversation back
					up whenever you're ready — even after its workspace goes to sleep.
				</p>
			</div>
		</section>

		<section class="rounded-lg border border-stone-200 bg-white p-6">
			<h2 class="text-sm font-semibold text-stone-900">How it works</h2>
			<ol class="mt-4 flex flex-col gap-3 text-sm text-stone-600">
				<li><span class="font-medium text-stone-900">1. Sign in.</span> You'll get your own organisation with a first Kitchen ready to go.</li>
				<li><span class="font-medium text-stone-900">2. Create an App.</span> Tell the agent what you want in plain language — a tool, a form, a small site, anything.</li>
				<li><span class="font-medium text-stone-900">3. Deploy it.</span> One click publishes your App to a real web address you can share.</li>
				<li><span class="font-medium text-stone-900">4. Invite your team.</span> Add chefs to your Kitchen so everyone can build together.</li>
			</ol>
		</section>
	</main>
</div>
