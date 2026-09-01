import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAppAccess } from '$lib/server/authz';
import { createAccessRule, listAccessRules, revokeAccessRule, type AccessRuleType } from '$lib/server/app-access';
import { effectiveKitchenSecrets } from '$lib/server/secrets';

// Mirrors the deploy route's credential resolution: a Kitchen-scoped
// CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID override beats the platform's
// own bound Worker secrets.
async function cfCreds(db: D1Database, kitchenId: string, platform: App.Platform | undefined) {
	const keyMaterial = platform?.env?.SECRET_ENCRYPTION_KEY;
	const kitchenSecrets = keyMaterial ? await effectiveKitchenSecrets(db, kitchenId, keyMaterial) : {};
	const token = kitchenSecrets.CLOUDFLARE_API_TOKEN ?? platform?.env?.CLOUDFLARE_API_TOKEN;
	const accountId = kitchenSecrets.CLOUDFLARE_ACCOUNT_ID ?? platform?.env?.CLOUDFLARE_ACCOUNT_ID;
	if (!token || !accountId) return null;
	return { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: accountId };
}

export const GET: RequestHandler = async (event) => {
	const { db, app } = await requireAppAccess(event);
	return json(await listAccessRules(db, app.id));
};

export const POST: RequestHandler = async (event) => {
	const { db, user, app } = await requireAppAccess(event);
	const body = (await event.request.json()) as { ruleType?: AccessRuleType; value?: string };
	const creds = await cfCreds(db, app.kitchenId, event.platform);
	await createAccessRule(
		db,
		user,
		app.id,
		{ ruleType: body.ruleType ?? 'email', value: String(body.value ?? '') },
		creds
	);
	return json({ ok: true });
};

export const DELETE: RequestHandler = async (event) => {
	const { db, user, app } = await requireAppAccess(event);
	const body = (await event.request.json()) as { ruleId?: string };
	const creds = await cfCreds(db, app.kitchenId, event.platform);
	await revokeAccessRule(db, user, app.id, String(body.ruleId ?? ''), creds);
	return json({ ok: true });
};
