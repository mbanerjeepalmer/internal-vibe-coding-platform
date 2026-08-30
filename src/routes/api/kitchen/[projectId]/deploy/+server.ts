import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSandboxProvider } from '$lib/server/opencode/sandbox';
import { requireAppAccess } from '$lib/server/authz';
import { getAppStorage, getOrCreateAppStorage } from '$lib/server/app-storage';

function cfCreds(platform: App.Platform | undefined) {
	const env = platform?.env;
	if (!env?.CLOUDFLARE_API_TOKEN || !env?.CLOUDFLARE_ACCOUNT_ID) return null;
	return { CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID };
}

// Runs `wrangler deploy` against whatever the agent has written in the
// project's sandbox — the "tighter end to end" flow from
// docs/04_tighter_end_to_end.md: chat with opencode, then deploy what it wrote.
export const POST: RequestHandler = async (event) => {
	const { db, app } = await requireAppAccess(event);
	const creds = cfCreds(event.platform);
	if (!creds) {
		return json(
			{ success: false, log: 'Missing CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID.' },
			{ status: 500 }
		);
	}
	const storage = await getOrCreateAppStorage(db, app.id, creds);
	const result = await getSandboxProvider().deployProject(app.id, creds, storage);
	return json(result);
};

// Tears down the worker this project deployed — scoped by construction, since
// `wrangler delete` reads the worker name out of the project's own
// wrangler.jsonc rather than taking one from the request, so this endpoint
// can never be used to delete a worker outside the caller's own project.
export const DELETE: RequestHandler = async (event) => {
	const { db, app } = await requireAppAccess(event);
	const creds = cfCreds(event.platform);
	if (!creds) {
		return json(
			{ success: false, log: 'Missing CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID.' },
			{ status: 500 }
		);
	}
	const storage = await getAppStorage(db, app.id);
	const result = await getSandboxProvider().undeployProject(app.id, creds, storage ?? undefined);
	return json(result);
};
