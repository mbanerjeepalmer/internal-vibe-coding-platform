import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	createApp,
	getKitchenAccess,
	listApps,
	listKitchenMembers,
	setKitchenAgentGuidance
} from '$lib/server/control-plane';
import { reconcileSandboxStates } from '$lib/server/opencode/sandbox';

const MAX_GUIDANCE_LENGTH = 12_000;

function db(platform: App.Platform | undefined) {
	if (!platform?.env.DB) throw error(500, 'Cloudflare D1 is required for the control plane.');
	return platform.env.DB;
}

export const load: PageServerLoad = async ({ params, locals, platform, url }) => {
	if (!locals.user) redirect(307, `/signin?next=${encodeURIComponent(url.pathname)}`);

	const database = db(platform);
	const kitchen = await getKitchenAccess(database, locals.user.id, params.kitchenId);
	if (!kitchen) throw error(404, 'Kitchen not found, or you do not have access to it.');

	const [apps, members] = await Promise.all([
		listApps(database, locals.user.id, kitchen.id),
		listKitchenMembers(database, kitchen.id)
	]);
	await reconcileSandboxStates(apps);

	return { kitchen, apps, members, user: locals.user };
};

export const actions: Actions = {
	createApp: async ({ request, locals, platform, params }) => {
		if (!locals.user) return fail(401, { message: 'Sign in first.' });
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { message: 'App name is required.' });
		let appId: string;
		try {
			({ id: appId } = await createApp(db(platform), locals.user, params.kitchenId, name));
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : String(err) });
		}
		redirect(303, `/apps/${appId}`);
	},

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
