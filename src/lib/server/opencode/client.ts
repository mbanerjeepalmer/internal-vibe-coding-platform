// Thin client for opencode's v2 HTTP API (`/api/...`), traced live against a
// real `opencode serve` (opencode-ai@1.18.25) rather than assumed from docs —
// see docs/03_opencode_backend_spec.md's open question about exact payload shapes.

import type { Sandbox } from './sandbox';

type Target = Pick<Sandbox, 'baseUrl' | 'headers'>;

export interface ModelRef {
	id: string;
	providerID: string;
	variant?: string;
}

export interface ModelSummary extends ModelRef {
	name: string;
	free?: boolean;
}

async function req<T>(target: Target, path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${target.baseUrl}${path}`, {
		...init,
		headers: { 'content-type': 'application/json', ...target.headers, ...init?.headers }
	});
	const body = await res.text();
	if (!res.ok) {
		throw new Error(`opencode ${init?.method ?? 'GET'} ${path} -> ${res.status}: ${body}`);
	}
	// Some opencode endpoints (e.g. model switch) reply 200 with an empty body.
	return (body ? JSON.parse(body) : undefined) as T;
}

export async function createSession(target: Target): Promise<{ id: string }> {
	const { data } = await req<{ data: { id: string } }>(target, '/api/session', {
		method: 'POST',
		body: JSON.stringify({})
	});
	return data;
}

export async function listModels(target: Target): Promise<ModelSummary[]> {
	const { data } = await req<{
		data: { id: string; providerID: string; name: string }[];
	}>(target, '/api/model');
	return data.map((m) => ({
		id: m.id,
		providerID: m.providerID,
		name: m.name,
		free: m.id.endsWith('-free')
	}));
}

export async function switchModel(target: Target, sessionId: string, model: ModelRef) {
	await req(target, `/api/session/${sessionId}/model`, {
		method: 'POST',
		body: JSON.stringify({ model })
	});
}

export interface PromptFile {
	/** `data:<mime>;base64,...` or `file://...` — see docs/01_hardcoded_demo.md's
	 * attachment findings: opencode forwards this as a multimodal content part to
	 * the model itself, so it only works with a model whose capabilities include
	 * the attached media type (verified live: a `text/plain` file fails against
	 * every free model tried, image/video attachments are structurally the same
	 * path but untested against a working model in this environment). */
	uri: string;
	mime: string;
	name: string;
}

export async function sendPrompt(
	target: Target,
	sessionId: string,
	text: string,
	files?: PromptFile[]
): Promise<{ id: string; admittedSeq: number }> {
	const { data } = await req<{ data: { id: string; admittedSeq: number } }>(
		target,
		`/api/session/${sessionId}/prompt`,
		{
			method: 'POST',
			body: JSON.stringify({ prompt: { text, files: files?.length ? files : undefined } })
		}
	);
	return data;
}

export async function interruptSession(target: Target, sessionId: string) {
	await req(target, `/api/session/${sessionId}/interrupt`, { method: 'POST' });
}

export interface PermissionRequest {
	id: string;
	action: string;
	resources: string[];
}

export async function listPermissions(target: Target, sessionId: string): Promise<PermissionRequest[]> {
	const { data } = await req<{ data: PermissionRequest[] }>(
		target,
		`/api/session/${sessionId}/permission`
	);
	return data;
}

export async function replyPermission(
	target: Target,
	sessionId: string,
	requestId: string,
	reply: 'once' | 'always' | 'reject'
) {
	await req(target, `/api/session/${sessionId}/permission/${requestId}/reply`, {
		method: 'POST',
		body: JSON.stringify({ reply })
	});
}

/**
 * Proxies the opencode server's durable, resumable SSE event stream for a
 * session. Passing `after` (the last seq the caller has seen) makes opencode
 * replay only what was missed; omitting it replays the whole session history
 * from the start, which is what lets a reopened session backfill its timeline
 * from this single endpoint instead of a separate messages call.
 */
export function eventStreamRequest(target: Target, sessionId: string, after?: string): Request {
	const url = new URL(`${target.baseUrl}/api/session/${sessionId}/event`);
	if (after) url.searchParams.set('after', after);
	return new Request(url, { headers: target.headers });
}
