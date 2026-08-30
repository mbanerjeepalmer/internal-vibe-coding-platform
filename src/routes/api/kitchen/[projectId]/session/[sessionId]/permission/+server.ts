import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSandboxProvider } from '$lib/server/opencode/sandbox';
import { listPermissions } from '$lib/server/opencode/client';
import { requireAppAccess } from '$lib/server/authz';

// opencode doesn't durably-event permission requests (they're absent from the
// SessionDurableEvent union in events.ts) — the client has to poll this while busy.
export const GET: RequestHandler = async (event) => {
	const { app } = await requireAppAccess(event);
	const sandbox = await getSandboxProvider().getOrCreateSandbox(app.id);
	const permissions = await listPermissions(sandbox, event.params.sessionId);
	return json({ permissions });
};
