import type { CloudflareCredentials } from './app-storage';

export type AccessRuleInput = { ruleType: 'email' | 'domain'; value: string };

type CloudflareResponse<T> = { success: boolean; result?: T; errors?: Array<{ message?: string }> };

function apiUrl(creds: CloudflareCredentials, path: string) {
	return `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(creds.CLOUDFLARE_ACCOUNT_ID)}${path}`;
}

async function cloudflare<T>(creds: CloudflareCredentials, path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(apiUrl(creds, path), {
		...init,
		headers: { Authorization: `Bearer ${creds.CLOUDFLARE_API_TOKEN}`, ...init?.headers }
	});
	const body = (await response.json()) as CloudflareResponse<T>;
	if (!response.ok || !body.success || body.result === undefined) {
		throw new Error(body.errors?.[0]?.message ?? `Cloudflare Access request failed (${response.status}).`);
	}
	return body.result;
}

/**
 * Looks up a deployed Worker's Cloudflare-side script id (the immutable
 * `tag`, not the human-readable script name) — Access applications attach
 * to a Worker by this id via `destinations: [{ type: 'worker', worker_id }]`.
 * Uses the script list endpoint rather than the single-script endpoint,
 * since the latter returns the script's code, not its metadata.
 */
export async function getWorkerScriptId(creds: CloudflareCredentials, scriptName: string): Promise<string | null> {
	const scripts = await cloudflare<Array<{ id: string; tag?: string }>>(creds, '/workers/scripts?per_page=100');
	return scripts.find((script) => script.id === scriptName)?.tag ?? null;
}

function everyonePolicy() {
	return [{ name: 'Public access', decision: 'allow' as const, include: [{ everyone: {} }] }];
}

function rulesToPolicy(rules: AccessRuleInput[]) {
	if (rules.length === 0) return everyonePolicy();
	const include = rules.map((rule) =>
		rule.ruleType === 'email' ? { email: { email: rule.value } } : { email_domain: { domain: rule.value } }
	);
	return [{ name: 'App access rules', decision: 'allow' as const, include }];
}

/**
 * Creates the (single, persistent) Access Application that protects a
 * deployed app's Worker across every hostname it's reachable on
 * (workers.dev, custom domains, previews). Starts out fully public —
 * callers sync the actual policy afterwards via `setAccessPolicy`.
 */
export async function createAccessApplication(
	creds: CloudflareCredentials,
	options: { name: string; workerId: string }
): Promise<string> {
	const created = await cloudflare<{ id: string }>(creds, '/access/apps', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			name: options.name,
			type: 'self_hosted',
			destinations: [{ type: 'worker', worker_id: options.workerId }],
			session_duration: '24h',
			policies: everyonePolicy()
		})
	});
	return created.id;
}

/**
 * Replaces an Access Application's policy with either "anyone" (no rules
 * configured) or an allow-list built from the given email/domain rules.
 * Read-modify-write against the current application so unrelated fields
 * (session duration, destinations, etc.) are preserved.
 */
export async function setAccessPolicy(creds: CloudflareCredentials, accessAppId: string, rules: AccessRuleInput[]) {
	const current = await cloudflare<Record<string, unknown>>(creds, `/access/apps/${encodeURIComponent(accessAppId)}`);
	await cloudflare(creds, `/access/apps/${encodeURIComponent(accessAppId)}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ ...current, policies: rulesToPolicy(rules) })
	});
}
