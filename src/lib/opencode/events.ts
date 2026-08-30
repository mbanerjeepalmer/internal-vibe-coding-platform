// Subset of opencode's SessionDurableEvent union that the UI reducer needs.
// Field names traced live against a real `opencode serve` (opencode-ai@1.18.25),
// not guessed from docs — see docs/03_opencode_backend_spec.md's open question.

interface Durable {
	aggregateID: string;
	seq: number;
	version: number;
}

interface BaseEvent<Type extends string, Data> {
	id: string;
	type: Type;
	durable: Durable;
	data: Data;
}

export type PromptAdmittedEvent = BaseEvent<
	'session.next.prompt.admitted',
	{ timestamp: number; sessionID: string; messageID: string; prompt: { text: string } }
>;

export type StepStartedEvent = BaseEvent<
	'session.next.step.started',
	{
		timestamp: number;
		sessionID: string;
		assistantMessageID: string;
		agent: string;
		model: { id: string; providerID: string; variant?: string };
	}
>;

export type StepEndedEvent = BaseEvent<
	'session.next.step.ended',
	{ timestamp: number; sessionID: string; assistantMessageID: string; finish: string }
>;

export type StepFailedEvent = BaseEvent<
	'session.next.step.failed',
	{
		timestamp: number;
		sessionID: string;
		assistantMessageID: string;
		error: { type: string; message: string };
	}
>;

export type TextStartedEvent = BaseEvent<
	'session.next.text.started',
	{ timestamp: number; sessionID: string; assistantMessageID: string; textID: string }
>;

export type TextEndedEvent = BaseEvent<
	'session.next.text.ended',
	{ timestamp: number; sessionID: string; assistantMessageID: string; textID: string; text: string }
>;

export type ToolCalledEvent = BaseEvent<
	'session.next.tool.called',
	{
		timestamp: number;
		sessionID: string;
		assistantMessageID: string;
		callID: string;
		tool: string;
		input: Record<string, unknown>;
	}
>;

export type ToolSuccessEvent = BaseEvent<
	'session.next.tool.success',
	{ timestamp: number; sessionID: string; assistantMessageID: string; callID: string }
>;

export type ToolFailedEvent = BaseEvent<
	'session.next.tool.failed',
	{
		timestamp: number;
		sessionID: string;
		assistantMessageID: string;
		callID: string;
		error: { type: string; message: string };
	}
>;

// opencode can emit plenty of other durable event types (agent switches,
// reasoning, compaction, retries, ...). We only type the ones the reducer
// acts on; anything else arrives with a `type` outside this union and the
// reducer's switch just falls through and ignores it (see the `as` cast at
// the JSON.parse call site — this is an unsafe narrowing, not a proof).
export type SessionEvent =
	| PromptAdmittedEvent
	| StepStartedEvent
	| StepEndedEvent
	| StepFailedEvent
	| TextStartedEvent
	| TextEndedEvent
	| ToolCalledEvent
	| ToolSuccessEvent
	| ToolFailedEvent;
