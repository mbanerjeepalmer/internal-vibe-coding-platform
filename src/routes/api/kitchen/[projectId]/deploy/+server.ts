import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSandboxProvider } from '$lib/server/opencode/sandbox';
import { requireAppAccess } from '$lib/server/authz';
import { getAppStorage, getOrCreateAppStorage } from '$lib/server/app-storage';
import { effectiveAppSecrets, effectiveKitchenSecrets } from '$lib/server/secrets';

// Resolution order mirrors resolveDefaultModel's Kitchen-override pattern:
// a Kitchen's own CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID (stored as
// Kitchen secrets, deploy-only — see effectiveKitchenSecrets, which reads
// regardless of `agent_visible` since this runs server-side, never in the
// agent's sandbox) beats the platform-wide Worker secret. A Kitchen that
// hasn't configured its own deploy credential falls back to the platform's.
async function cfCreds(db: D1Database, kitchenId: string, platform: App.Platform | undefined) {
	const keyMaterial = platform?.env?.SECRET_ENCRYPTION_KEY;
	const kitchenSecrets = keyMaterial ? await effectiveKitchenSecrets(db, kitchenId, keyMaterial) : {};
	const token = kitchenSecrets.CLOUDFLARE_API_TOKEN ?? platform?.env?.CLOUDFLARE_API_TOKEN;
	const accountId = kitchenSecrets.CLOUDFLARE_ACCOUNT_ID ?? platform?.env?.CLOUDFLARE_ACCOUNT_ID;
	if (!token || !accountId) return null;
	return { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: accountId };
}

// Runs `wrangler deploy` against whatever the agent has written in the
// project's sandbox — the "tighter end to end" flow from
// docs/04_tighter_end_to_end.md: chat with opencode, then deploy what it wrote.
export const POST: RequestHandler = async (event) => {
	const { db, app } = await requireAppAccess(event);
	const creds = await cfCreds(db, app.kitchenId, event.platform);
	if (!creds) {
		return json(
			{ success: false, log: 'Missing CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID.' },
			{ status: 500 }
		);
	}
	const storage = await getOrCreateAppStorage(db, app.id, creds);
	const secrets = await effectiveAppSecrets(db, app.id, event.platform?.env.SECRET_ENCRYPTION_KEY);
	const result = await getSandboxProvider().deployProject(app.id, creds, storage, secrets);
	return json(result);
};

// Tears down the worker this project deployed — scoped by construction, since
// `wrangler delete` reads the worker name out of the project's own
// wrangler.jsonc rather than taking one from the request, so this endpoint
// can never be used to delete a worker outside the caller's own project.
export const DELETE: RequestHandler = async (event) => {
	const { db, app } = await requireAppAccess(event);
	const creds = await cfCreds(db, app.kitchenId, event.platform);
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
