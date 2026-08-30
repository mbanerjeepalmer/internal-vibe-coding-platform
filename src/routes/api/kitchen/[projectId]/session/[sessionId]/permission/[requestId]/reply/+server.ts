import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSandboxProvider } from '$lib/server/opencode/sandbox';
import { replyPermission } from '$lib/server/opencode/client';
import { requireAppAccess } from '$lib/server/authz';

export const POST: RequestHandler = async (event) => {
	const { app } = await requireAppAccess(event);
	const sandbox = await getSandboxProvider().getOrCreateSandbox(app.id);
	const { reply } = (await event.request.json()) as { reply: 'once' | 'always' | 'reject' };
	await replyPermission(sandbox, event.params.sessionId, event.params.requestId, reply);
	return json({ ok: true });
};
