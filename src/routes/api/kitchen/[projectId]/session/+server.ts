import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSandboxProvider } from '$lib/server/opencode/sandbox';
import { createSession, switchModel, type ModelRef } from '$lib/server/opencode/client';
import { requireAppAccess } from '$lib/server/authz';
import { markSandboxActive } from '$lib/server/control-plane';

export const POST: RequestHandler = async (event) => {
	const { db, app } = await requireAppAccess(event);
	const sandbox = await getSandboxProvider().getOrCreateSandbox(app.id);
	const session = await createSession(sandbox);

	const body = (await event.request.json().catch(() => ({}))) as { model?: ModelRef };
	if (body.model) {
		await switchModel(sandbox, session.id, body.model);
	}

	await markSandboxActive(db, app.id, session.id);
	return json({ sessionId: session.id });
};
