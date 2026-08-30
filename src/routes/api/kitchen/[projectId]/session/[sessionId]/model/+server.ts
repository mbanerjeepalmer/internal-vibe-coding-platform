import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSandboxProvider } from '$lib/server/opencode/sandbox';
import { switchModel, type ModelRef } from '$lib/server/opencode/client';

export const POST: RequestHandler = async ({ params, request }) => {
	const sandbox = await getSandboxProvider().getOrCreateSandbox(params.projectId);
	const { model } = (await request.json()) as { model: ModelRef };
	await switchModel(sandbox, params.sessionId, model);
	return json({ ok: true });
};
