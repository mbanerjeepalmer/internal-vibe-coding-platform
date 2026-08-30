import type { RequestHandler } from './$types';
import { getSandboxProvider } from '$lib/server/opencode/sandbox';
import { eventStreamRequest } from '$lib/server/opencode/client';

// Proxies opencode's durable per-session SSE stream as a same-origin SSE stream.
// The browser reconnects with `?after=<last_seen_seq>` (see reducer.ts on the
// client) so a dropped connection never loses or duplicates events — this is
// opencode's server doing the replay, we're just re-emitting its bytes.
export const GET: RequestHandler = async ({ params, url, fetch }) => {
	const sandbox = await getSandboxProvider().getOrCreateSandbox(params.projectId);
	const after = url.searchParams.get('after') ?? undefined;
	const upstream = await fetch(eventStreamRequest(sandbox, params.sessionId, after));

	if (!upstream.ok || !upstream.body) {
		return new Response(await upstream.text(), { status: upstream.status });
	}

	return new Response(upstream.body, {
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-cache',
			connection: 'keep-alive'
		}
	});
};
