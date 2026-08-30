// Provisions a throwaway Better Auth identity directly in the local D1
// database and produces a session cookie for it, so Playwright (or any
// script) can start "signed in" without sending a real magic-link email.
//
// Local-only: writes through `wrangler d1 execute --local`, which never
// touches the remote database, and signs cookies with the dev placeholder
// secret in `.dev.vars` (safe to read — it is not a real credential).
//
// Mirrors the cookie format Better Auth's HTTP layer (`better-call`)
// produces in src/cookies/index.mjs — reimplemented here rather than
// imported from that package's internals, which aren't a public API and
// can change shape between versions.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export const SESSION_COOKIE_NAME = 'better-auth.session_token';

function loadDevVar(name: string): string {
	if (process.env[name]) return process.env[name]!;
	const raw = readFileSync(new URL('../../.dev.vars', import.meta.url), 'utf8');
	for (const line of raw.split('\n')) {
		const [key, ...rest] = line.split('=');
		if (key?.trim() === name) return rest.join('=').trim();
	}
	throw new Error(`${name} not found in the environment or .dev.vars`);
}

/** Single-quotes and escapes a value for inline SQL — fine for fixture data with known, simple content. */
function sqlString(value: string) {
	return `'${value.replace(/'/g, "''")}'`;
}

function d1Exec(sql: string) {
	execFileSync(
		'npx',
		['wrangler', 'd1', 'execute', 'ivcp-control-plane', '--local', '--command', sql],
		{ cwd: new URL('../..', import.meta.url).pathname, stdio: 'pipe' }
	);
}

async function signSessionCookie(token: string, secret: string) {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(token));
	const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)));
	return encodeURIComponent(`${token}.${base64Signature}`);
}

export type DevIdentity = { userId: string; name: string; email: string };

/**
 * Upserts a Better Auth user + session row for `identity` (deterministic
 * `userId` so repeated test runs reuse the same row instead of piling up
 * throwaway users) and returns a ready-to-use session cookie.
 */
export async function provisionDevSession(identity: DevIdentity) {
	const secret = loadDevVar('BETTER_AUTH_SECRET');
	const token = `dev-session-${identity.userId}`;
	const now = new Date().toISOString();
	const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

	d1Exec(
		`INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt)
		 VALUES (${sqlString(identity.userId)}, ${sqlString(identity.name)}, ${sqlString(identity.email)}, 1, ${sqlString(now)}, ${sqlString(now)})
		 ON CONFLICT(id) DO UPDATE SET name = excluded.name, email = excluded.email, updatedAt = excluded.updatedAt;
		 INSERT INTO session (id, expiresAt, token, createdAt, updatedAt, userId)
		 VALUES (${sqlString(`sess-${identity.userId}`)}, ${sqlString(expires)}, ${sqlString(token)}, ${sqlString(now)}, ${sqlString(now)}, ${sqlString(identity.userId)})
		 ON CONFLICT(id) DO UPDATE SET expiresAt = excluded.expiresAt, token = excluded.token, updatedAt = excluded.updatedAt;`
	);

	const cookieValue = await signSessionCookie(token, secret);
	return {
		identity,
		cookie: {
			name: SESSION_COOKIE_NAME,
			value: cookieValue
		}
	};
}

/**
 * Removes a dev identity and everything it owns. Only safe for fixture
 * users that own nothing outside their own organisation — `apps`,
 * `invitations` and `secrets` reference `created_by` without cascading, so
 * a user who authored either of those in someone else's Kitchen would need
 * those rows cleared first.
 */
export function teardownDevSession(userId: string) {
	d1Exec(
		`DELETE FROM organisations WHERE id IN (
		   SELECT organisation_id FROM organisation_memberships WHERE user_id = ${sqlString(userId)} AND role = 'owner'
		 );
		 DELETE FROM organisation_memberships WHERE user_id = ${sqlString(userId)};
		 DELETE FROM "user" WHERE id = ${sqlString(userId)};`
	);
}
