import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSandboxProvider } from '$lib/server/opencode/sandbox';
import { DEFAULT_MODEL, listModels, type ModelSummary } from '$lib/server/opencode/client';
import { requireAppAccess } from '$lib/server/authz';

export const GET: RequestHandler = async (event) => {
	const { app } = await requireAppAccess(event);
	const sandbox = await getSandboxProvider().getOrCreateSandbox(app.id);
	const models = await listModels(sandbox);

	// Precedence: the Kitchen's Head-Chef-set override, then the platform
	// default (Luna), then the old best-effort fallback for a sandbox where
	// neither is actually available (e.g. local dev — see sandbox.ts).
	const find = (id: string | null, providerID: string | null) =>
		id && providerID ? models.find((m) => m.id === id && m.providerID === providerID) : undefined;
	const defaultModel: ModelSummary | null =
		find(app.defaultModelId, app.defaultModelProviderId) ??
		find(DEFAULT_MODEL.id, DEFAULT_MODEL.providerID) ??
		models.find((m) => m.providerID === 'openai') ??
		models.find((m) => m.free) ??
		models[0] ??
		null;

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
