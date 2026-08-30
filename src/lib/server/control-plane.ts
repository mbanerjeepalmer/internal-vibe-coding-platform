export type UserIdentity = { id: string; name: string; email: string };
export type KitchenRole = 'head_chef' | 'chef';

const now = () => new Date().toISOString();

function appBranch(name: string, id: string) {
	const slug = name
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '')
		.slice(0, 48);
	return `apps/${slug || 'app'}-${id.slice(0, 8)}`;
}

export async function ensureOrganisation(db: D1Database, user: UserIdentity) {
	const existing = await db
		.prepare(
			`SELECT o.id, o.name FROM organisations o
			 JOIN organisation_memberships m ON m.organisation_id = o.id
			 WHERE m.user_id = ? ORDER BY o.created_at LIMIT 1`
		)
		.bind(user.id)
		.first<{ id: string; name: string }>();
	if (existing) return existing;

	const organisationId = crypto.randomUUID();
	const kitchenId = crypto.randomUUID();
	const timestamp = now();
	const organisationName = `${user.name || user.email}'s organisation`;
	await db.batch([
		db
			.prepare('INSERT INTO organisations (id, name, created_at) VALUES (?, ?, ?)')
			.bind(organisationId, organisationName, timestamp),
		db
			.prepare(
				'INSERT INTO organisation_memberships (organisation_id, user_id, role, created_at) VALUES (?, ?, ?, ?)'
			)
			.bind(organisationId, user.id, 'owner', timestamp),
		db
			.prepare('INSERT INTO kitchens (id, organisation_id, name, created_at) VALUES (?, ?, ?, ?)')
			.bind(kitchenId, organisationId, 'My Kitchen', timestamp),
		db
			.prepare(
				'INSERT INTO kitchen_memberships (kitchen_id, user_id, role, created_at) VALUES (?, ?, ?, ?)'
			)
			.bind(kitchenId, user.id, 'head_chef', timestamp)
	]);
	return { id: organisationId, name: organisationName };
}

export async function listKitchens(db: D1Database, userId: string) {
	const result = await db
		.prepare(
			`SELECT DISTINCT k.id, k.name, k.organisation_id AS organisationId,
			 COUNT(DISTINCT a.id) AS appCount
			 FROM kitchens k
			 LEFT JOIN apps a ON a.kitchen_id = k.id
			 LEFT JOIN kitchen_memberships km ON km.kitchen_id = k.id
			 LEFT JOIN organisation_memberships om ON om.organisation_id = k.organisation_id
			 WHERE km.user_id = ? OR (om.user_id = ? AND om.role = 'owner')
			 GROUP BY k.id ORDER BY k.created_at`
		)
		.bind(userId, userId)
		.all<{ id: string; name: string; organisationId: string; appCount: number }>();
	return result.results;
}

export async function getKitchenAccess(db: D1Database, userId: string, kitchenId: string) {
	return db
		.prepare(
			`SELECT k.id, k.name, k.organisation_id AS organisationId,
			 CASE WHEN om.role = 'owner' THEN 'head_chef' ELSE km.role END AS role
			 FROM kitchens k
			 LEFT JOIN kitchen_memberships km ON km.kitchen_id = k.id AND km.user_id = ?
			 LEFT JOIN organisation_memberships om ON om.organisation_id = k.organisation_id AND om.user_id = ?
			 WHERE k.id = ? AND (km.user_id IS NOT NULL OR om.role = 'owner')`
		)
		.bind(userId, userId, kitchenId)
		.first<{ id: string; name: string; organisationId: string; role: KitchenRole }>();
}

export async function createApp(db: D1Database, user: UserIdentity, kitchenId: string, name: string) {
	const kitchen = await getKitchenAccess(db, user.id, kitchenId);
	if (!kitchen) throw new Error('You do not have access to this Kitchen.');
	const id = crypto.randomUUID();
	const timestamp = now();
	const branch = appBranch(name, id);
	await db
		.prepare(
			`INSERT INTO apps (id, kitchen_id, name, created_by, git_branch, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(id, kitchenId, name.trim(), user.id, branch, timestamp, timestamp)
		.run();
	return { id, branch };
}

export async function getAppAccess(db: D1Database, userId: string, appId: string) {
	return db
		.prepare(
			`SELECT a.id, a.name, a.kitchen_id AS kitchenId, a.git_branch AS gitBranch,
			 a.sandbox_id AS sandboxId, a.opencode_session_id AS opencodeSessionId,
			 CASE WHEN om.role = 'owner' THEN 'head_chef' ELSE km.role END AS role
			 FROM apps a JOIN kitchens k ON k.id = a.kitchen_id
			 LEFT JOIN kitchen_memberships km ON km.kitchen_id = k.id AND km.user_id = ?
			 LEFT JOIN organisation_memberships om ON om.organisation_id = k.organisation_id AND om.user_id = ?
			 WHERE a.id = ? AND (km.user_id IS NOT NULL OR om.role = 'owner')`
		)
		.bind(userId, userId, appId)
		.first<{
			id: string;
			name: string;
			kitchenId: string;
			gitBranch: string;
			sandboxId: string | null;
			opencodeSessionId: string | null;
			role: KitchenRole;
		}>();
}
