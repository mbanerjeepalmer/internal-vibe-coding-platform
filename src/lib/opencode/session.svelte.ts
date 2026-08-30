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

export interface PermissionRequest {
	id: string;
	action: string;
	resources: string[];
}

export interface PromptFile {
	uri: string;
	mime: string;
	name: string;
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
	canSetKitchenDefault = $state(false);
	kitchenDefaultOverride = $state<ModelRef | null>(null);
	pendingPermissions = $state<PermissionRequest[]>([]);
	destroyed = $state(false);
	deploying = $state(false);
	deployed = $state(false);
	deployResult = $state<{ action: 'deploy' | 'undeploy'; success: boolean; log: string; url?: string } | null>(
		null
	);

	sessionId: string | null = null;
	private itemIndex = new Map<string, number>();
	private lastSeq = 0;
	private eventSource: EventSource | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private permissionPollTimer: ReturnType<typeof setInterval> | null = null;

	constructor(private projectId: string) {}

	async init() {
		// A cold sandbox can take up to ~5min to provision (see
		// docs/03_opencode_backend_spec.md), and the request that lands on a
		// still-provisioning sandbox can fail transiently (proxy timeout,
		// connection reset) well before that. Retry with backoff instead of
		// surfacing a one-shot failure that only a manual page refresh recovers.
		const modelsRes = await this.fetchWithRetry(`/api/kitchen/${this.projectId}/models`);
		const { models, defaultModel, canSetKitchenDefault, kitchenDefaultOverride } =
			(await modelsRes.json()) as {
				models: ModelSummary[];
				defaultModel: ModelSummary | null;
				canSetKitchenDefault: boolean;
				kitchenDefaultOverride: ModelRef | null;
			};
		this.models = models;
		this.canSetKitchenDefault = canSetKitchenDefault;
		this.kitchenDefaultOverride = kitchenDefaultOverride;
		// The server already resolved this (Kitchen override, else the
		// platform default "Luna", else a best-effort fallback) — see
		// src/routes/api/kitchen/[projectId]/models/+server.ts.
		this.model = defaultModel ?? models[0] ?? null;

		const sessionRes = await this.fetchWithRetry(`/api/kitchen/${this.projectId}/session`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ model: this.model })
		});
		const { sessionId } = (await sessionRes.json()) as { sessionId: string };
		this.sessionId = sessionId;
		this.connect();

		// opencode doesn't durably-event permission requests, so we poll for
		// them — see the note in the server-side permission route.
		this.permissionPollTimer = setInterval(() => this.pollPermissions(), 1500);
	}

	private async fetchWithRetry(url: string, init?: RequestInit, maxAttempts = 8) {
		let lastErr: unknown;
		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			if (attempt > 0) await new Promise((r) => setTimeout(r, Math.min(2000 * attempt, 15000)));
			try {
				const res = await fetch(url, init);
				if (res.ok) return res;
				lastErr = new Error(`${res.status} ${res.statusText}`);
			} catch (err) {
				lastErr = err;
			}
		}
		throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
	}

	private async pollPermissions() {
		if (!this.sessionId || this.destroyed) return;
		try {
			const res = await fetch(
				`/api/kitchen/${this.projectId}/session/${this.sessionId}/permission`
			);
			const { permissions } = (await res.json()) as { permissions: PermissionRequest[] };
			this.pendingPermissions = permissions;
		} catch {
			// Transient — next poll will retry.
		}
	}

	async replyPermission(requestId: string, reply: 'once' | 'always' | 'reject') {
		if (!this.sessionId) return;
		await fetch(
			`/api/kitchen/${this.projectId}/session/${this.sessionId}/permission/${requestId}/reply`,
			{
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ reply })
			}
		);
		this.pendingPermissions = this.pendingPermissions.filter((p) => p.id !== requestId);
	}

	async deploy() {
		await this.runDeployAction('deploy');
	}

	/** Tears down the worker this project deployed (not the sandbox itself — see `destroySandbox`). */
	async undeploy() {
		await this.runDeployAction('undeploy');
	}

	private async runDeployAction(action: 'deploy' | 'undeploy') {
		this.deploying = true;
		this.deployResult = null;
		try {
			const res = await fetch(`/api/kitchen/${this.projectId}/deploy`, {
				method: action === 'deploy' ? 'POST' : 'DELETE'
			});
			const body = (await res.json()) as { success: boolean; log: string; url?: string };
			this.deployResult = { action, ...body };
			if (body.success) this.deployed = action === 'deploy';
		} catch (err) {
			this.deployResult = {
				action,
				success: false,
				log: err instanceof Error ? err.message : String(err)
			};
		} finally {
			this.deploying = false;
		}
	}

	async destroySandbox() {
		this.dispose();
		await fetch(`/api/kitchen/${this.projectId}`, { method: 'DELETE' });
		this.destroyed = true;
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

	async sendPrompt(text: string, files?: PromptFile[]) {
		if (!this.sessionId || (!text.trim() && !files?.length)) return;
		await fetch(`/api/kitchen/${this.projectId}/session/${this.sessionId}/prompt`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ text, files })
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

	/** Head-Chef-only: makes `model` (or, if null, the platform default "Luna") every app in this Kitchen starts with. */
	async setKitchenDefault(model: ModelRef | null) {
		await fetch(`/api/kitchen/${this.projectId}/kitchen-default-model`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ model })
		});
		this.kitchenDefaultOverride = model;
	}

	dispose() {
		this.eventSource?.close();
		if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
		if (this.permissionPollTimer) clearInterval(this.permissionPollTimer);
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
