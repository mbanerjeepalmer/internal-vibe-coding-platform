import { error } from '@sveltejs/kit';
import { getAppAccess, listKitchenMembers, type UserIdentity } from './control-plane';
import type { CloudflareCredentials } from './app-storage';
import { createAccessApplication, setAccessPolicy, type AccessRuleInput } from './cloudflare-access';

export type AccessRuleType = 'email' | 'domain';
export type AccessRule = { id: string; ruleType: AccessRuleType; value: string; createdAt: string };

function normalizeDomain(value: string) {
	return value.trim().toLowerCase().replace(/^@/, '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

export async function listAccessRules(db: D1Database, appId: string): Promise<AccessRule[]> {
	const result = await db
		.prepare(
			'SELECT id, rule_type AS ruleType, value, created_at AS createdAt FROM app_access_rules WHERE app_id = ? ORDER BY created_at'
		)
		.bind(appId)
		.all<AccessRule>();
	return result.results;
}

async function appAccessRow(db: D1Database, appId: string) {
	return db
		.prepare('SELECT kitchen_id AS kitchenId, cf_worker_id AS cfWorkerId, cf_access_app_id AS cfAccessAppId FROM apps WHERE id = ?')
		.bind(appId)
		.first<{ kitchenId: string; cfWorkerId: string | null; cfAccessAppId: string | null }>();
}

/**
 * Pushes the app's current allow-list to Cloudflare: everyone (no rules
 * configured yet) or the configured rules plus the app's Kitchen members
 * (so a chef can never lock themselves out of their own app). No-ops if
 * the app has no Access Application yet (never deployed / no rule ever
 * added).
 */
async function syncAccessPolicy(db: D1Database, appId: string, creds: CloudflareCredentials) {
	const app = await appAccessRow(db, appId);
	if (!app?.cfAccessAppId) return;

	const rules = await listAccessRules(db, appId);
	if (rules.length === 0) {
		await setAccessPolicy(creds, app.cfAccessAppId, []);
		return;
	}

	const members = await listKitchenMembers(db, app.kitchenId);
	const combined: AccessRuleInput[] = [
		...rules.map((rule) => ({ ruleType: rule.ruleType, value: rule.value })),
		...members.map((member) => ({ ruleType: 'email' as const, value: member.email.toLowerCase() }))
	];
	const seen = new Set<string>();
	const deduped = combined.filter((rule) => {
		const key = `${rule.ruleType}:${rule.value}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
	await setAccessPolicy(creds, app.cfAccessAppId, deduped);
}

export async function createAccessRule(
	db: D1Database,
	actor: UserIdentity,
	appId: string,
	input: { ruleType: AccessRuleType; value: string },
	creds: CloudflareCredentials | null
) {
	const access = await getAppAccess(db, actor.id, appId);
	if (!access) throw error(404, 'App not found.');

	if (input.ruleType !== 'email' && input.ruleType !== 'domain') throw error(400, 'Invalid rule type.');
	const value = input.ruleType === 'email' ? input.value.trim().toLowerCase() : normalizeDomain(input.value);
	if (input.ruleType === 'email' && !value.includes('@')) throw error(400, 'Enter a valid email address.');
	if (input.ruleType === 'domain' && (!value.includes('.') || value.includes('@'))) {
		throw error(400, 'Enter a valid domain, e.g. example.com.');
	}

	const app = await appAccessRow(db, appId);
	if (!app?.cfWorkerId) throw error(400, 'Deploy the app at least once before configuring access rules.');
	if (!creds) throw error(500, 'Missing CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID.');

	let accessAppId = app.cfAccessAppId;
	if (!accessAppId) {
		accessAppId = await createAccessApplication(creds, { name: `Vibe app: ${access.name}`, workerId: app.cfWorkerId });
		await db.prepare('UPDATE apps SET cf_access_app_id = ? WHERE id = ?').bind(accessAppId, appId).run();
	}

	await db
		.prepare(
			`INSERT INTO app_access_rules (id, app_id, rule_type, value, created_by, created_at)
			 VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(app_id, rule_type, value) DO NOTHING`
		)
		.bind(crypto.randomUUID(), appId, input.ruleType, value, actor.id, new Date().toISOString())
		.run();

	await syncAccessPolicy(db, appId, creds);
}

export async function revokeAccessRule(
	db: D1Database,
	actor: UserIdentity,
	appId: string,
	ruleId: string,
	creds: CloudflareCredentials | null
) {
	const access = await getAppAccess(db, actor.id, appId);
	if (!access) throw error(404, 'App not found.');
	if (!creds) throw error(500, 'Missing CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID.');

	await db.prepare('DELETE FROM app_access_rules WHERE id = ? AND app_id = ?').bind(ruleId, appId).run();
	await syncAccessPolicy(db, appId, creds);
}
