import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSandboxProvider } from '$lib/server/opencode/sandbox';
import { listModels, resolveDefaultModel } from '$lib/server/opencode/client';
import { requireAppAccess } from '$lib/server/authz';
import { resolveSandboxStartOptions } from '$lib/server/sandbox-context';

// The client's own startup sequence calls this route before /session (see
// OpencodeSession.init), so this — not /session — is usually the request
// that actually provisions a brand-new sandbox. It must resolve the same
// Kitchen skills and restoreSnapshot as /session and /prompt, or a
// previously saved snapshot would silently never get restored.
export const GET: RequestHandler = async (event) => {
	const { db, app } = await requireAppAccess(event);
	const options = await resolveSandboxStartOptions(db, app, event.platform);
	const sandbox = await getSandboxProvider().getOrCreateSandbox(app.id, options);
	const models = await listModels(sandbox);
	const defaultModel = resolveDefaultModel(models, app);

	return json({
		models,
		defaultModel,
		canSetKitchenDefault: app.role === 'head_chef',
		kitchenDefaultOverride:
			app.defaultModelId && app.defaultModelProviderId
				? { id: app.defaultModelId, providerID: app.defaultModelProviderId }
				: null
	});
};
