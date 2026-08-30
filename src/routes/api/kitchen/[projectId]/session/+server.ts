import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSandboxProvider } from '$lib/server/opencode/sandbox';
import { createSession, listModels, resolveDefaultModel, switchModel } from '$lib/server/opencode/client';
import { requireAppAccess } from '$lib/server/authz';
import { claimSharedOpencodeSession, getAppAccess } from '$lib/server/control-plane';
import { effectiveAppSecrets } from '$lib/server/secrets';

export const POST: RequestHandler = async (event) => {
	const { db, user, app } = await requireAppAccess(event);
	// The App, rather than an individual chef/browser, owns its sandbox and
	// OpenCode conversation. Reopening the App therefore resumes its timeline.
	if (app.opencodeSessionId) return json({ sessionId: app.opencodeSessionId });

	const secrets = await effectiveAppSecrets(db, app.id, event.platform?.env.SECRET_ENCRYPTION_KEY);
	const sandbox = await getSandboxProvider().getOrCreateSandbox(app.id, app.agentGuidance, secrets);
	const session = await createSession(sandbox);

	// Resolve the model ourselves rather than trust whatever the client sent:
	// the client resolves its own default from the /models route, and on a
	// cold sandbox that fetch can land before opencode has finished loading
	// its providers and come back with an empty list — silently skipping this
	// switch left brand-new Apps permanently stuck on opencode's own default
	// model instead of Luna, since a shared App session, once created, is
	// reused by every future request and never gets its model touched again.
	const models = await listModels(sandbox);
	const defaultModel = resolveDefaultModel(models, app);
	if (defaultModel) {
		await switchModel(sandbox, session.id, defaultModel);
	}

	if (await claimSharedOpencodeSession(db, app.id, session.id)) {
		return json({ sessionId: session.id });
	}

	// Another chef created the shared session while this request was starting.
	const current = await getAppAccess(db, user.id, app.id);
	if (!current?.opencodeSessionId) throw new Error('Unable to establish the shared OpenCode conversation.');
	return json({ sessionId: current.opencodeSessionId });
};
