import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getUserProfile } from '$lib/server/control-plane';

export const load: PageServerLoad = async ({ params, locals, platform, url }) => {
	if (!locals.user) redirect(307, `/signin?next=${encodeURIComponent(url.pathname)}`);

	const db = platform?.env.DB;
	if (!db) throw error(500, 'Cloudflare D1 is required for the control plane.');

	const profile = await getUserProfile(db, locals.user.id, params.userId);
	if (!profile) throw error(404, 'User not found.');

	return { profile, isSelf: params.userId === locals.user.id };
};
