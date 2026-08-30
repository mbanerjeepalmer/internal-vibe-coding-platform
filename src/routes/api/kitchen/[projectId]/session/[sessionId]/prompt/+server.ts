import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSandboxProvider } from '$lib/server/opencode/sandbox';
import { sendPrompt, type PromptFile } from '$lib/server/opencode/client';
import { requireActiveAppSession } from '$lib/server/authz';

export const POST: RequestHandler = async (event) => {
	const { app } = await requireActiveAppSession(event);
	const sandbox = await getSandboxProvider().getOrCreateSandbox(app.id, app.agentGuidance);
	const { text, files } = (await event.request.json()) as { text: string; files?: PromptFile[] };
	if (!text?.trim() && !files?.length) {
		return json({ error: 'text or files required' }, { status: 400 });
	}
	const result = await sendPrompt(sandbox, event.params.sessionId, text, files);
	return json(result);
};
