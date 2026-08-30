import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSandboxProvider } from '$lib/server/opencode/sandbox';
import { listModels } from '$lib/server/opencode/client';

export const GET: RequestHandler = async ({ params }) => {
	const sandbox = await getSandboxProvider().getOrCreateSandbox(params.projectId);
	const models = await listModels(sandbox);
	return json({ models });
};
