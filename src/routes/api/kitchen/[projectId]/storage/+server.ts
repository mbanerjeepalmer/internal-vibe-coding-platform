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

function credentials(platform: App.Platform | undefined): CloudflareCredentials {
	const env = platform?.env;
	if (!env?.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) throw error(500, 'Cloudflare credentials are unavailable.');
	return { CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID };
}

async function access(event: Parameters<RequestHandler>[0]) {
	const result = await requireAppAccess(event);
	if (result.app.role !== 'head_chef') throw error(403, 'Only a Head Chef can manage persistent storage.');
	return result;
}

export const GET: RequestHandler = async (event) => {
	const { db, app } = await access(event);
	return json({ linked: await getAppStorage(db, app.id), orphans: await listOrphanedAppStorage(db, credentials(event.platform)) });
};

export const POST: RequestHandler = async (event) => {
	const { db, app } = await access(event);
	const body = (await event.request.json()) as { action?: string; databaseId?: string; confirmation?: string };
	if (body.action === 'unlink') await unlinkAppStorage(db, app.id, body.confirmation ?? '');
	else if (body.action === 'relink' && body.databaseId) await relinkAppStorage(db, app.id, body.databaseId, credentials(event.platform));
	else if (body.action === 'destroy') await destroyAppStorage(db, app.id, body.confirmation ?? '', credentials(event.platform));
	else throw error(400, 'Unknown storage action.');
	return json({ linked: await getAppStorage(db, app.id) });
};
