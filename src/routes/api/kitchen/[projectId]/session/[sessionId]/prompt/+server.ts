import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSandboxProvider } from '$lib/server/opencode/sandbox';
import { sendPrompt } from '$lib/server/opencode/client';

export const POST: RequestHandler = async ({ params, request }) => {
	const sandbox = await getSandboxProvider().getOrCreateSandbox(params.projectId);
	const { text } = (await request.json()) as { text: string };
	if (!text?.trim()) {
		return json({ error: 'text is required' }, { status: 400 });
	}
	const result = await sendPrompt(sandbox, params.sessionId, text);
	return json(result);
};
