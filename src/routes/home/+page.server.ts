import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	createApp,
	createInvitation,
	createKitchen,
	ensureOrganisation,
	getOrganisationRole,
	listApps,
	listKitchens,
	listPendingInvitations,
	revokeInvitation
} from '$lib/server/control-plane';
import { sendInvitationEmail } from '$lib/server/mail';
import { reconcileSandboxStates } from '$lib/server/opencode/sandbox';
import { isExecutiveChef } from '$lib/server/executive';

function db(platform: App.Platform | undefined) {
	if (!platform?.env.DB) throw new Error('Cloudflare D1 is required for the control plane.');
	return platform.env.DB;
}

export const load: PageServerLoad = async ({ locals, platform, url }) => {
	if (!locals.user) redirect(307, `/signin?next=${encodeURIComponent(url.pathname)}`);

	const database = db(platform);
	const organisation = await ensureOrganisation(database, locals.user);
	const role = await getOrganisationRole(database, locals.user.id, organisation.id);
	const kitchens = await listKitchens(database, locals.user.id);
	const apps = Object.fromEntries(
		await Promise.all(
			kitchens.map(async (k) => [k.id, await listApps(database, locals.user!.id, k.id)] as const)
		)
	);
	await reconcileSandboxStates(Object.values(apps).flat());
	const pendingInvitations =
		role === 'owner' ? await listPendingInvitations(database, organisation.id) : [];

	return {
		user: locals.user,
		organisation,
		role,
		kitchens,
		apps,
		pendingInvitations,
		isExecutiveChef: await isExecutiveChef(database, locals.user.id)
	};
};

export const actions: Actions = {
	createKitchen: async ({ request, locals, platform }) => {
		if (!locals.user) return fail(401, { message: 'Sign in first.' });
		const form = await request.formData();
		const organisationId = String(form.get('organisationId') ?? '');
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { message: 'Kitchen name is required.' });
		try {
			await createKitchen(db(platform), locals.user, organisationId, name);
		} catch (error) {
			return fail(400, { message: error instanceof Error ? error.message : String(error) });
		}
		return { success: true };
	},

	invite: async ({ request, locals, platform, url }) => {
		if (!locals.user) return fail(401, { message: 'Sign in first.' });
		const form = await request.formData();
		const organisationId = String(form.get('organisationId') ?? '');
		const kitchenId = String(form.get('kitchenId') ?? '') || undefined;
		const kitchenName = String(form.get('kitchenName') ?? '') || undefined;
		const kitchenRole = (String(form.get('kitchenRole') ?? 'chef') || 'chef') as 'head_chef' | 'chef';
		const email = String(form.get('email') ?? '').trim();
		const organisationName = String(form.get('organisationName') ?? 'your organisation');

		if (!email) return fail(400, { message: 'Enter an email address.' });

		try {
			const database = db(platform);
			const { token } = await createInvitation(database, locals.user, {
				organisationId,
				kitchenId,
				email,
				organisationRole: 'member',
				kitchenRole: kitchenId ? kitchenRole : undefined
			});
			await sendInvitationEmail(platform!.env, {
				to: email,
				url: `${url.origin}/invite/${token}`,
				organisationName,
				kitchenName
			});
		} catch (error) {
			return fail(400, { message: error instanceof Error ? error.message : String(error) });
		}
		return { success: true };
	},

	createApp: async ({ request, locals, platform }) => {
		if (!locals.user) return fail(401, { message: 'Sign in first.' });
		const form = await request.formData();
		const kitchenId = String(form.get('kitchenId') ?? '');
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { message: 'App name is required.' });
		let appId: string;
		try {
			({ id: appId } = await createApp(db(platform), locals.user, kitchenId, name));
		} catch (error) {
			return fail(400, { message: error instanceof Error ? error.message : String(error) });
		}
		redirect(303, `/apps/${appId}`);
	},

	revokeInvitation: async ({ request, locals, platform }) => {
		if (!locals.user) return fail(401, { message: 'Sign in first.' });
		const form = await request.formData();
		const invitationId = String(form.get('invitationId') ?? '');
		try {
			await revokeInvitation(db(platform), locals.user, invitationId);
		} catch (error) {
			return fail(400, { message: error instanceof Error ? error.message : String(error) });
		}
		return { success: true };
	}
};
