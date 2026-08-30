import type { SessionEvent } from './events';

export type TimelineItem =
	| { kind: 'user'; id: string; text: string }
	| { kind: 'agent-text'; id: string; text: string; done: boolean }
	| {
			kind: 'tool';
			id: string;
			tool: string;
			input: Record<string, unknown>;
			status: 'pending' | 'done' | 'error';
			error?: string;
	  }
	| { kind: 'error'; id: string; message: string };

export interface ModelRef {
	id: string;
	providerID: string;
}

export interface ModelSummary extends ModelRef {
	name: string;
	free?: boolean;
}

/**
 * Drives the chat timeline off opencode's durable per-session SSE stream.
 * One class instance == one opencode session's live view. Reconnects with
 * `?after=<lastSeq>` on any dropped connection so opencode replays only what
 * was missed (see docs/03_opencode_backend_spec.md, session lifecycle §5).
 */
export class OpencodeSession {
	items = $state<TimelineItem[]>([]);
	busy = $state(false);
	connected = $state(false);
	models = $state<ModelSummary[]>([]);
	model = $state<ModelSummary | null>(null);

	sessionId: string | null = null;
	private itemIndex = new Map<string, number>();
	private lastSeq = 0;
	private eventSource: EventSource | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(private projectId: string) {}

	async init() {
		const modelsRes = await fetch(`/api/kitchen/${this.projectId}/models`);
		const { models } = (await modelsRes.json()) as { models: ModelSummary[] };
		this.models = models;
		this.model = models.find((m) => m.free) ?? models[0] ?? null;

		const sessionRes = await fetch(`/api/kitchen/${this.projectId}/session`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ model: this.model })
		});
		const { sessionId } = (await sessionRes.json()) as { sessionId: string };
		this.sessionId = sessionId;
		this.connect();
	}

	private connect() {
		if (!this.sessionId) return;
		this.eventSource?.close();
		const url = `/api/kitchen/${this.projectId}/session/${this.sessionId}/events${
			this.lastSeq ? `?after=${this.lastSeq}` : ''
		}`;
		const es = new EventSource(url);
		this.eventSource = es;
		es.onopen = () => (this.connected = true);
		es.onmessage = (evt) => {
			try {
				this.apply(JSON.parse(evt.data) as SessionEvent);
			} catch {
				// Malformed frame — skip it rather than tearing down the stream.
			}
		};
		es.onerror = () => {
			this.connected = false;
			es.close();
			if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
			this.reconnectTimer = setTimeout(() => this.connect(), 1500);
		};
	}

	async sendPrompt(text: string) {
		if (!this.sessionId || !text.trim()) return;
		await fetch(`/api/kitchen/${this.projectId}/session/${this.sessionId}/prompt`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ text })
		});
	}

	async setModel(model: ModelSummary) {
		this.model = model;
		if (!this.sessionId) return;
		await fetch(`/api/kitchen/${this.projectId}/session/${this.sessionId}/model`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ model })
		});
	}

	dispose() {
		this.eventSource?.close();
		if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
	}

	private upsert(item: TimelineItem) {
		const existingIndex = this.itemIndex.get(item.id);
		if (existingIndex === undefined) {
			this.itemIndex.set(item.id, this.items.length);
			this.items.push(item);
		} else {
			this.items[existingIndex] = item;
		}
	}

	private apply(event: SessionEvent) {
		this.lastSeq = Math.max(this.lastSeq, event.durable.seq);

		switch (event.type) {
			case 'session.next.prompt.admitted':
				this.upsert({ kind: 'user', id: event.data.messageID, text: event.data.prompt.text });
				break;

			case 'session.next.step.started':
				this.busy = true;
				break;

			case 'session.next.step.ended':
				this.busy = false;
				break;

			case 'session.next.step.failed':
				this.busy = false;
				this.upsert({
					kind: 'error',
					id: `${event.data.assistantMessageID}:error`,
					message: event.data.error.message
				});
				break;

			case 'session.next.text.started':
				this.upsert({ kind: 'agent-text', id: event.data.textID, text: '', done: false });
				break;

			case 'session.next.text.ended':
				this.upsert({
					kind: 'agent-text',
					id: event.data.textID,
					text: event.data.text,
					done: true
				});
				break;

			case 'session.next.tool.called':
				this.upsert({
					kind: 'tool',
					id: event.data.callID,
					tool: event.data.tool,
					input: event.data.input,
					status: 'pending'
				});
				break;

			case 'session.next.tool.success': {
				const existing = this.items[this.itemIndex.get(event.data.callID) ?? -1];
				this.upsert({
					kind: 'tool',
					id: event.data.callID,
					tool: existing?.kind === 'tool' ? existing.tool : 'tool',
					input: existing?.kind === 'tool' ? existing.input : {},
					status: 'done'
				});
				break;
			}

			case 'session.next.tool.failed': {
				const existing = this.items[this.itemIndex.get(event.data.callID) ?? -1];
				this.upsert({
					kind: 'tool',
					id: event.data.callID,
					tool: existing?.kind === 'tool' ? existing.tool : 'tool',
					input: existing?.kind === 'tool' ? existing.input : {},
					status: 'error',
					error: event.data.error.message
				});
				break;
			}
		}
	}
}
