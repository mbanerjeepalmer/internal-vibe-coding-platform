import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSandboxProvider } from '$lib/server/opencode/sandbox';
import { createSession, switchModel, type ModelRef } from '$lib/server/opencode/client';

export const POST: RequestHandler = async ({ params, request }) => {
	const sandbox = await getSandboxProvider().getOrCreateSandbox(params.projectId);
	const session = await createSession(sandbox);

	const body = (await request.json().catch(() => ({}))) as { model?: ModelRef };
	if (body.model) {
		await switchModel(sandbox, session.id, body.model);
	}

	return json({ sessionId: session.id });
};
