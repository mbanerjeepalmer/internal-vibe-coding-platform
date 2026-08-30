import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSandboxProvider } from '$lib/server/opencode/sandbox';
import { replyPermission } from '$lib/server/opencode/client';

export const POST: RequestHandler = async ({ params, request }) => {
	const sandbox = await getSandboxProvider().getOrCreateSandbox(params.projectId);
	const { reply } = (await request.json()) as { reply: 'once' | 'always' | 'reject' };
	await replyPermission(sandbox, params.sessionId, params.requestId, reply);
	return json({ ok: true });
};
