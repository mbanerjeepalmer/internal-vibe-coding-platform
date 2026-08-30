import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSandboxProvider } from '$lib/server/opencode/sandbox';
import { listModels, resolveDefaultModel } from '$lib/server/opencode/client';
import { requireAppAccess } from '$lib/server/authz';

export const GET: RequestHandler = async (event) => {
	const { app } = await requireAppAccess(event);
	const sandbox = await getSandboxProvider().getOrCreateSandbox(app.id, app.agentGuidance);
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
