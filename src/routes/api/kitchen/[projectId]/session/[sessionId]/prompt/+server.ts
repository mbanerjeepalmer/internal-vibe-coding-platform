import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSandboxProvider } from '$lib/server/opencode/sandbox';
import { sendPrompt, type PromptFile } from '$lib/server/opencode/client';

export const POST: RequestHandler = async ({ params, request }) => {
	const sandbox = await getSandboxProvider().getOrCreateSandbox(params.projectId);
	const { text, files } = (await request.json()) as { text: string; files?: PromptFile[] };
	if (!text?.trim() && !files?.length) {
		return json({ error: 'text or files required' }, { status: 400 });
	}
	const result = await sendPrompt(sandbox, params.sessionId, text, files);
	return json(result);
};
