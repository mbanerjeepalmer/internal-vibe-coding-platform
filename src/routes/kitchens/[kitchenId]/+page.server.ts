import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getKitchenAccess, setKitchenAgentGuidance } from '$lib/server/control-plane';

const MAX_GUIDANCE_LENGTH = 12_000;

function db(platform: App.Platform | undefined) {
	if (!platform?.env.DB) throw error(500, 'Cloudflare D1 is required for the control plane.');
	return platform.env.DB;
}

export const load: PageServerLoad = async ({ params, locals, platform, url }) => {
	if (!locals.user) redirect(307, `/signin?next=${encodeURIComponent(url.pathname)}`);
	const kitchen = await getKitchenAccess(db(platform), locals.user.id, params.kitchenId);
	if (!kitchen) throw error(404, 'Kitchen not found, or you do not have access to it.');
	return { kitchen };
};

export const actions: Actions = {
	saveGuidance: async ({ request, locals, platform, params }) => {
		if (!locals.user) return fail(401, { message: 'Sign in first.' });
		const guidance = String((await request.formData()).get('guidance') ?? '').trim();
		if (guidance.length > MAX_GUIDANCE_LENGTH) {
			return fail(400, { message: `Guidance must be ${MAX_GUIDANCE_LENGTH} characters or fewer.` });
		}
		try {
			await setKitchenAgentGuidance(db(platform), locals.user.id, params.kitchenId, guidance);
		} catch (cause) {
			return fail(403, { message: cause instanceof Error ? cause.message : String(cause) });
		}
		return { success: true };
	}
};
