import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAppAccess } from '$lib/server/authz';
import {
	destroyAppStorage,
	getAppStorage,
	listOrphanedAppStorage,
	relinkAppStorage,
	unlinkAppStorage,
	type CloudflareCredentials
} from '$lib/server/app-storage';
import { effectiveKitchenSecrets } from '$lib/server/secrets';

// Same Kitchen-secret-overrides-platform-default precedence as the deploy
// route's cfCreds — see that file's comment for why.
async function credentials(db: D1Database, kitchenId: string, platform: App.Platform | undefined): Promise<CloudflareCredentials> {
	const keyMaterial = platform?.env?.SECRET_ENCRYPTION_KEY;
	const kitchenSecrets = keyMaterial ? await effectiveKitchenSecrets(db, kitchenId, keyMaterial) : {};
	const token = kitchenSecrets.CLOUDFLARE_API_TOKEN ?? platform?.env?.CLOUDFLARE_API_TOKEN;
	const accountId = kitchenSecrets.CLOUDFLARE_ACCOUNT_ID ?? platform?.env?.CLOUDFLARE_ACCOUNT_ID;
	if (!token || !accountId) throw error(500, 'Cloudflare credentials are unavailable.');
	return { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: accountId };
}

async function access(event: Parameters<RequestHandler>[0]) {
	const result = await requireAppAccess(event);
	if (result.app.role !== 'head_chef') throw error(403, 'Only a Head Chef can manage persistent storage.');
	return result;
}

export const GET: RequestHandler = async (event) => {
	const { db, app } = await access(event);
	const creds = await credentials(db, app.kitchenId, event.platform);
	return json({ linked: await getAppStorage(db, app.id), orphans: await listOrphanedAppStorage(db, creds) });
};

export const POST: RequestHandler = async (event) => {
	const { db, app } = await access(event);
	const body = (await event.request.json()) as { action?: string; databaseId?: string; confirmation?: string };
	if (body.action === 'unlink') await unlinkAppStorage(db, app.id, body.confirmation ?? '');
	else if (body.action === 'relink' && body.databaseId) await relinkAppStorage(db, app.id, body.databaseId, await credentials(db, app.kitchenId, event.platform));
	else if (body.action === 'destroy') await destroyAppStorage(db, app.id, body.confirmation ?? '', await credentials(db, app.kitchenId, event.platform));
	else throw error(400, 'Unknown storage action.');
	return json({ linked: await getAppStorage(db, app.id) });
};
