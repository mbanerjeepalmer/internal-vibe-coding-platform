import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSandboxProvider } from '$lib/server/opencode/sandbox';
import { createSession, switchModel, type ModelRef } from '$lib/server/opencode/client';
import { requireAppAccess } from '$lib/server/authz';
import { claimSharedOpencodeSession, getAppAccess } from '$lib/server/control-plane';

export const POST: RequestHandler = async (event) => {
	const { db, user, app } = await requireAppAccess(event);
	// The App, rather than an individual chef/browser, owns its sandbox and
	// OpenCode conversation. Reopening the App therefore resumes its timeline.
	if (app.opencodeSessionId) return json({ sessionId: app.opencodeSessionId });

	const sandbox = await getSandboxProvider().getOrCreateSandbox(app.id);
	const session = await createSession(sandbox);

	const body = (await event.request.json().catch(() => ({}))) as { model?: ModelRef };
	if (body.model) {
		await switchModel(sandbox, session.id, body.model);
	}

	if (await claimSharedOpencodeSession(db, app.id, session.id)) {
		return json({ sessionId: session.id });
	}

	// Another chef created the shared session while this request was starting.
	const current = await getAppAccess(db, user.id, app.id);
	if (!current?.opencodeSessionId) throw new Error('Unable to establish the shared OpenCode conversation.');
	return json({ sessionId: current.opencodeSessionId });
};
