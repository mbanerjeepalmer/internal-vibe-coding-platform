import { error } from '@sveltejs/kit';

export type AdminActionKind = 'sql' | 'bash';
export type AdminActionStatus = 'ok' | 'error';

export interface AdminAction {
	id: string;
	actorId: string;
	actorEmail: string;
	kitchenId: string | null;
	appId: string | null;
	kind: AdminActionKind;
	command: string;
	comment: string | null;
	forced: boolean;
	status: AdminActionStatus;
	result: string | null;
	createdAt: string;
}

export async function isExecutiveChef(db: D1Database, userId: string): Promise<boolean> {
	const row = await db.prepare('SELECT 1 FROM platform_admins WHERE user_id = ?').bind(userId).first();
	return row !== null;
}

/**
 * Guards a route to Executive Chefs only. There's no UI path to create the
 * first one — see AGENTS.md for the one-time `wrangler d1 execute` bootstrap
 * that inserts directly into platform_admins.
 */
export async function requireExecutiveChef(event: {
	platform?: App.Platform;
	locals: App.Locals;
}): Promise<{ db: D1Database; userId: string }> {
	const db = event.platform?.env.DB;
	if (!db) throw error(500, 'Cloudflare D1 is required for the control plane.');
	if (!event.locals.user) throw error(401, 'Sign in required.');
	if (!(await isExecutiveChef(db, event.locals.user.id))) {
		throw error(403, 'Executive Chef access required.');
	}
	return { db, userId: event.locals.user.id };
}

export async function listExecutiveChefs(db: D1Database) {
	const result = await db
		.prepare(
			`SELECT u.id, u.email, u.name, pa.created_at AS grantedAt, granter.email AS grantedByEmail
			 FROM platform_admins pa
			 JOIN "user" u ON u.id = pa.user_id
			 LEFT JOIN "user" granter ON granter.id = pa.granted_by
			 ORDER BY pa.created_at`
		)
		.all<{ id: string; email: string; name: string; grantedAt: string; grantedByEmail: string | null }>();
	return result.results;
}

export async function grantExecutiveChef(db: D1Database, actorId: string, targetEmail: string) {
	const target = await db
		.prepare('SELECT id FROM "user" WHERE email = ?')
		.bind(targetEmail.trim().toLowerCase())
		.first<{ id: string }>();
	if (!target) throw error(404, `No user with email ${targetEmail}.`);
	await db
		.prepare(
			`INSERT INTO platform_admins (user_id, granted_by, created_at) VALUES (?, ?, ?)
			 ON CONFLICT(user_id) DO NOTHING`
		)
		.bind(target.id, actorId, new Date().toISOString())
		.run();
}

export async function revokeExecutiveChef(db: D1Database, actorId: string, targetUserId: string) {
	if (actorId === targetUserId) {
		throw error(400, 'You cannot revoke your own Executive Chef access here — have another Executive Chef do it.');
	}
	await db.prepare('DELETE FROM platform_admins WHERE user_id = ?').bind(targetUserId).run();
}

export async function logAdminAction(
	db: D1Database,
	entry: {
		actorId: string;
		kitchenId?: string | null;
		appId?: string | null;
		kind: AdminActionKind;
		command: string;
		comment: string | null;
		forced: boolean;
		status: AdminActionStatus;
		result: string | null;
	}
) {
	await db
		.prepare(
			`INSERT INTO admin_actions (id, actor_id, kitchen_id, app_id, kind, command, comment, forced, status, result, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			crypto.randomUUID(),
			entry.actorId,
			entry.kitchenId ?? null,
			entry.appId ?? null,
			entry.kind,
			entry.command,
			entry.comment,
			entry.forced ? 1 : 0,
			entry.status,
			entry.result,
			new Date().toISOString()
		)
		.run();
}

export async function listAdminActions(db: D1Database, limit = 100): Promise<AdminAction[]> {
	const result = await db
		.prepare(
			`SELECT a.id, a.actor_id AS actorId, u.email AS actorEmail, a.kitchen_id AS kitchenId, a.app_id AS appId,
			 a.kind, a.command, a.comment, a.forced, a.status, a.result, a.created_at AS createdAt
			 FROM admin_actions a JOIN "user" u ON u.id = a.actor_id
			 ORDER BY a.created_at DESC LIMIT ?`
		)
		.bind(limit)
		.all<Omit<AdminAction, 'forced'> & { forced: number }>();
	return result.results.map((row) => ({ ...row, forced: row.forced === 1 }));
}

/**
 * Accident-prevention only, not a tenant-isolation boundary — an Executive
 * Chef is already authorised for the whole instance, so this just blocks the
 * shapes of statement that are never useful here and are easy to regret: more
 * than one statement per run, PRAGMA/ATTACH/DETACH, and comments that could
 * hide what actually ran from someone reading the audit log later.
 */
export function assertSingleSafeStatement(sql: string) {
	const trimmed = sql.trim().replace(/;\s*$/, '');
	if (!trimmed) throw error(400, 'Enter a SQL statement.');
	if (/;.*\S/is.test(trimmed)) throw error(400, 'One statement per run — split multiple statements into separate runs.');
	if (/\bpragma\b|\battach\b|\bdetach\b/is.test(trimmed)) {
		throw error(400, 'PRAGMA/ATTACH/DETACH are not supported here.');
	}
	if (/--|\/\*/.test(trimmed)) throw error(400, 'Comments are not supported — the audit log should show exactly what ran.');
	return trimmed;
}
