import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAppAccess } from '$lib/server/control-plane';

export const load: PageServerLoad = async ({ params, locals, platform, url }) => {
	if (!locals.user) redirect(307, `/signin?next=${encodeURIComponent(url.pathname)}`);

	const db = platform?.env.DB;
	if (!db) throw error(500, 'Cloudflare D1 is required for the control plane.');

	const app = await getAppAccess(db, locals.user.id, params.appId);
	if (!app) throw error(404, 'App not found, or you do not have access to it.');

	return { app, user: locals.user };
};
