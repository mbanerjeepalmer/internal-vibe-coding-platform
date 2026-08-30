import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSandboxProvider } from '$lib/server/opencode/sandbox';
import { listModels } from '$lib/server/opencode/client';
import { requireAppAccess } from '$lib/server/authz';

export const GET: RequestHandler = async (event) => {
	const { app } = await requireAppAccess(event);
	const sandbox = await getSandboxProvider().getOrCreateSandbox(app.id);
	const models = await listModels(sandbox);
	return json({ models });
};
