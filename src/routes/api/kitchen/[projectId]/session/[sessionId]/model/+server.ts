import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSandboxProvider } from '$lib/server/opencode/sandbox';
import { switchModel, type ModelRef } from '$lib/server/opencode/client';
import { requireActiveAppSession } from '$lib/server/authz';

export const POST: RequestHandler = async (event) => {
	const { app } = await requireActiveAppSession(event);
	const sandbox = await getSandboxProvider().getOrCreateSandbox(app.id);
	const { model } = (await event.request.json()) as { model: ModelRef };
	await switchModel(sandbox, event.params.sessionId, model);
	return json({ ok: true });
};
