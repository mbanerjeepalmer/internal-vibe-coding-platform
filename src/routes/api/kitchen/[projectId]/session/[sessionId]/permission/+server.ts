import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSandboxProvider } from '$lib/server/opencode/sandbox';
import { listPermissions } from '$lib/server/opencode/client';

// opencode doesn't durably-event permission requests (they're absent from the
// SessionDurableEvent union in events.ts) — the client has to poll this while busy.
export const GET: RequestHandler = async ({ params }) => {
	const sandbox = await getSandboxProvider().getOrCreateSandbox(params.projectId);
	const permissions = await listPermissions(sandbox, params.sessionId);
	return json({ permissions });
};
