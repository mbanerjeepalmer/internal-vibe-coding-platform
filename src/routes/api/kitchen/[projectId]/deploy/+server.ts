import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSandboxProvider } from '$lib/server/opencode/sandbox';

// Runs `wrangler deploy` against whatever the agent has written in the
// project's sandbox — the "tighter end to end" flow from
// docs/04_tighter_end_to_end.md: chat with opencode, then deploy what it wrote.
export const POST: RequestHandler = async ({ params, platform }) => {
	const cfEnv = platform?.env;
	if (!cfEnv?.CLOUDFLARE_API_TOKEN || !cfEnv?.CLOUDFLARE_ACCOUNT_ID) {
		return json(
			{ success: false, log: 'Missing CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID.' },
			{ status: 500 }
		);
	}

	const result = await getSandboxProvider().deployProject(params.projectId, {
		CLOUDFLARE_API_TOKEN: cfEnv.CLOUDFLARE_API_TOKEN,
		CLOUDFLARE_ACCOUNT_ID: cfEnv.CLOUDFLARE_ACCOUNT_ID
	});
	return json(result);
};
