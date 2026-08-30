import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getAppAccess, renameApp } from '$lib/server/control-plane';

export const load: PageServerLoad = async ({ params, locals, platform, url }) => {
	if (!locals.user) redirect(307, `/signin?next=${encodeURIComponent(url.pathname)}`);

	const db = platform?.env.DB;
	if (!db) throw error(500, 'Cloudflare D1 is required for the control plane.');

	const app = await getAppAccess(db, locals.user.id, params.appId);
	if (!app) throw error(404, 'App not found, or you do not have access to it.');

	return { app, user: locals.user };
};

export const actions: Actions = {
	rename: async ({ request, locals, platform, params }) => {
		if (!locals.user) return fail(401, { message: 'Sign in first.' });
		const db = platform?.env.DB;
		if (!db) return fail(500, { message: 'Cloudflare D1 is required for the control plane.' });
		const form = await request.formData();
		const name = String(form.get('name') ?? '');
		try {
			await renameApp(db, locals.user, params.appId, name);
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : String(err) });
		}
		return { success: true };
	}
};
