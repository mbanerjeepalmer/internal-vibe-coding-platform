<script lang="ts">
	type Suggestion = { text: string; testId?: string };

	let {
		value = $bindable(''),
		placeholder = 'Ask, plan, or build anything',
		suggestions = [],
		disabled = false,
		busy = false,
		showAttach = true,
		attachChip = null,
		inputTestId,
		submitTestId,
		attachTestId = 'attach-file',
		agentLabel = 'Build',
		onSubmit,
		onAttach
	}: {
		value?: string;
		placeholder?: string;
		suggestions?: Suggestion[];
		disabled?: boolean;
		busy?: boolean;
		showAttach?: boolean;
		attachChip?: string | null;
		inputTestId?: string;
		submitTestId?: string;
		attachTestId?: string;
		agentLabel?: string;
		onSubmit?: (text: string) => void;
		onAttach?: () => void;
	} = $props();

	function submit() {
		if (disabled || busy) return;
		if (!value.trim() && !attachChip) return;
		onSubmit?.(value);
	}

	function pickSuggestion(text: string) {
		if (disabled || busy) return;
		onSubmit?.(text);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			submit();
		}
	}
</script>

<div class="flex flex-col gap-2">
	{#if suggestions.length > 0}
		<div class="flex flex-wrap gap-2">
			{#each suggestions as suggestion (suggestion.text)}
				<button
					type="button"
					data-testid={suggestion.testId}
					onclick={() => pickSuggestion(suggestion.text)}
					class="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm hover:border-blue-400 hover:text-blue-700"
				>
					{suggestion.text}
				</button>
			{/each}
		</div>
	{/if}

	{#if showAttach}
		<button
			type="button"
			data-testid={attachTestId}
			onclick={() => onAttach?.()}
			class="flex w-fit items-center gap-2 rounded-md border border-dashed border-blue-300 bg-blue-50 px-4 py-2 text-sm text-blue-700 hover:bg-blue-100"
		>
			📎 Attach voice_notes_from_whatsapp.mp4
		</button>
	{/if}

	<div
		class="flex flex-col rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_24px_-16px_rgba(15,23,42,0.25)]"
	>
		{#if attachChip}
			<div class="flex gap-2 overflow-x-auto border-b border-slate-100 px-3 pt-3 pb-2">
				<div
					class="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600"
				>
					<span>🎬</span>
					<span class="max-w-[14rem] truncate">{attachChip}</span>
				</div>
			</div>
		{/if}

		<textarea
			bind:value
			onkeydown={handleKeydown}
			{disabled}
			data-testid={inputTestId}
			{placeholder}
			rows="1"
			class="max-h-40 min-h-[52px] w-full resize-none bg-transparent px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
		></textarea>

		<div class="flex items-center justify-between px-2.5 pt-1 pb-2.5">
			<div class="flex items-center gap-1.5">
				<button
					type="button"
					title="Attach, run a command, or reference context"
					class="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
				>
					+
				</button>
				<span
					class="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600"
				>
					{agentLabel}
				</span>
			</div>

			<button
				type="button"
				data-testid={submitTestId}
				onclick={submit}
				disabled={disabled || busy}
				aria-label={busy ? 'Stop' : 'Send'}
				class="flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors disabled:cursor-not-allowed disabled:bg-slate-300 {busy
					? 'bg-slate-700'
					: 'bg-blue-600 hover:bg-blue-700'}"
			>
				{#if busy}
					<span class="h-2.5 w-2.5 rounded-[2px] bg-white"></span>
				{:else}
					<span class="-mr-px text-sm">↑</span>
				{/if}
			</button>
		</div>
	</div>
</div>
