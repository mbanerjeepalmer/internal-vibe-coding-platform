import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { acceptInvitation, getInvitationByToken } from '$lib/server/control-plane';

function db(platform: App.Platform | undefined) {
	if (!platform?.env.DB) throw new Error('Cloudflare D1 is required for the control plane.');
	return platform.env.DB;
}

export const load: PageServerLoad = async ({ params, platform, locals }) => {
	const invitation = await getInvitationByToken(db(platform), params.token);
	return { invitation, user: locals.user };
};

export const actions: Actions = {
	accept: async ({ params, locals, platform }) => {
		if (!locals.user) return fail(401, { message: 'Sign in first.' });
		try {
			await acceptInvitation(db(platform), locals.user, params.token);
		} catch (error) {
			return fail(400, { message: error instanceof Error ? error.message : String(error) });
		}
		redirect(303, '/home');
	}
};
