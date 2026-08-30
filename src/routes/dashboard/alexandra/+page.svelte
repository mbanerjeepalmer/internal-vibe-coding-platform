<script lang="ts">
	import TopBar from '$lib/components/TopBar.svelte';
	import { proposedChange } from '$lib/data/config-diff';

	let decision = $state<'pending' | 'approved' | 'rejected'>('pending');
	let requireApproval = $state(false);
</script>

<div class="flex min-h-screen flex-col">
	<TopBar name="Maurice" role="Kitchen owner" />

	<div class="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
		<div class="rounded-md bg-stone-100 px-3 py-2 text-xs text-stone-500">
			Viewing Alexandra's kitchen as Maurice
		</div>

		<div class="rounded-lg border border-stone-200 bg-white p-4">
			<p class="mb-1 text-sm font-semibold text-stone-900">🗺️ Wherever — Google Maps alternative</p>
			<p class="mb-3 text-xs text-stone-500">maps-alternative.vibe.kitchen</p>
			<div class="flex gap-3 text-sm">
				<a href="/chat" data-testid="view-conversation" class="text-amber-700 hover:underline"
					>View build conversation</a
				>
				<a href="/fix" data-testid="view-fix-session" class="text-amber-700 hover:underline"
					>View fix session</a
				>
			</div>
		</div>

		<div class="rounded-lg border border-emerald-200 bg-emerald-50 p-4" data-testid="config-diff">
			<p class="mb-2 text-xs font-semibold tracking-wide text-emerald-700 uppercase">
				+ Proposed by {proposedChange.proposedBy}
			</p>
			<p class="mb-1 text-sm font-semibold text-stone-900">{proposedChange.title}</p>
			<p class="mb-3 text-sm text-stone-600">{proposedChange.body}</p>

			{#if decision === 'pending'}
				<div class="flex gap-2">
					<button
						type="button"
						data-testid="approve-change"
						onclick={() => (decision = 'approved')}
						class="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
					>
						Approve
					</button>
					<button
						type="button"
						data-testid="reject-change"
						onclick={() => (decision = 'rejected')}
						class="rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-100"
					>
						Reject
					</button>
				</div>
			{:else if decision === 'approved'}
				<p
					class="inline-block rounded-md bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-800"
					data-testid="decision-status"
				>
					Approved ✅ — now part of the Kitchen config for everyone
				</p>
			{:else}
				<p
					class="inline-block rounded-md bg-stone-200 px-3 py-1.5 text-sm font-medium text-stone-700"
					data-testid="decision-status"
				>
					Rejected
				</p>
			{/if}
		</div>

		<div class="rounded-lg border border-stone-200 bg-white p-4">
			<p class="mb-1 text-sm font-semibold text-stone-900">Permissions</p>
			<label class="flex items-center justify-between gap-4 py-2">
				<span class="text-sm text-stone-600">Require approval before deploy</span>
				<button
					type="button"
					role="switch"
					aria-checked={requireApproval}
					aria-label="Require approval before deploy"
					data-testid="require-approval-toggle"
					onclick={() => (requireApproval = !requireApproval)}
					class="relative h-6 w-11 rounded-full transition-colors {requireApproval
						? 'bg-amber-600'
						: 'bg-stone-300'}"
				>
					<span
						class="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform {requireApproval
							? 'left-[22px]'
							: 'left-0.5'}"
					></span>
				</button>
			</label>
			{#if requireApproval}
				<p class="text-xs text-emerald-700" data-testid="approval-confirmation">
					Alexandra's deploys will now need your approval.
				</p>
			{/if}
		</div>
	</div>
</div>
