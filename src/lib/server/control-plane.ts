export type UserIdentity = { id: string; name: string; email: string };
export type KitchenRole = 'head_chef' | 'chef';
export type OrganisationRole = 'owner' | 'member';

const now = () => new Date().toISOString();

async function recordActivity(
	db: D1Database,
	organisationId: string,
	actorId: string,
	resourceType: string,
	resourceId: string,
	action: string
) {
	await db
		.prepare(
			`INSERT INTO activity_events (id, organisation_id, actor_id, resource_type, resource_id, action, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(crypto.randomUUID(), organisationId, actorId, resourceType, resourceId, action, now())
		.run();
}

async function hashToken(token: string) {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

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

export async function getOrganisationRole(db: D1Database, userId: string, organisationId: string) {
	const row = await db
		.prepare('SELECT role FROM organisation_memberships WHERE organisation_id = ? AND user_id = ?')
		.bind(organisationId, userId)
		.first<{ role: OrganisationRole }>();
	return row?.role ?? null;
}

export async function listKitchens(db: D1Database, userId: string) {
	const result = await db
		.prepare(
			`SELECT DISTINCT k.id, k.name, k.organisation_id AS organisationId,
			 (SELECT COUNT(*) FROM apps a WHERE a.kitchen_id = k.id) AS appCount,
			 (SELECT COUNT(*) FROM kitchen_memberships m WHERE m.kitchen_id = k.id) AS memberCount,
			 (SELECT u.name FROM kitchen_memberships hc
			    JOIN "user" u ON u.id = hc.user_id
			    WHERE hc.kitchen_id = k.id AND hc.role = 'head_chef'
			    ORDER BY hc.created_at LIMIT 1) AS headChefName
			 FROM kitchens k
			 LEFT JOIN kitchen_memberships km ON km.kitchen_id = k.id
			 LEFT JOIN organisation_memberships om ON om.organisation_id = k.organisation_id
			 WHERE km.user_id = ? OR (om.user_id = ? AND om.role = 'owner')
			 GROUP BY k.id ORDER BY k.created_at`
		)
		.bind(userId, userId)
		.all<{
			id: string;
			name: string;
			organisationId: string;
			appCount: number;
			memberCount: number;
			headChefName: string | null;
		}>();
	return result.results;
}

export async function createKitchen(
	db: D1Database,
	user: UserIdentity,
	organisationId: string,
	name: string
) {
	const role = await getOrganisationRole(db, user.id, organisationId);
	if (role !== 'owner') throw new Error('Only an organisation owner can create a Kitchen.');
	const id = crypto.randomUUID();
	const timestamp = now();
	await db.batch([
		db
			.prepare('INSERT INTO kitchens (id, organisation_id, name, created_at) VALUES (?, ?, ?, ?)')
			.bind(id, organisationId, name.trim(), timestamp),
		db
			.prepare(
				'INSERT INTO kitchen_memberships (kitchen_id, user_id, role, created_at) VALUES (?, ?, ?, ?)'
			)
			.bind(id, user.id, 'head_chef', timestamp)
	]);
	await recordActivity(db, organisationId, user.id, 'kitchen', id, 'created');
	return { id };
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
	await recordActivity(db, kitchen.organisationId, user.id, 'app', id, 'created');
	return { id, branch };
}

export async function listApps(db: D1Database, userId: string, kitchenId: string) {
	const kitchen = await getKitchenAccess(db, userId, kitchenId);
	if (!kitchen) throw new Error('You do not have access to this Kitchen.');
	const result = await db
		.prepare(
			`SELECT id, name, sandbox_state AS sandboxState, updated_at AS updatedAt
			 FROM apps WHERE kitchen_id = ? ORDER BY updated_at DESC`
		)
		.bind(kitchenId)
		.all<{ id: string; name: string; sandboxState: string; updatedAt: string }>();
	return result.results;
}

export async function markSandboxActive(db: D1Database, appId: string, opencodeSessionId: string) {
	await db
		.prepare(
			`UPDATE apps SET sandbox_id = ?, opencode_session_id = ?, sandbox_state = 'running', updated_at = ?
			 WHERE id = ?`
		)
		.bind(appId, opencodeSessionId, now(), appId)
		.run();
}

/**
 * Claims an OpenCode session as the App's shared conversation.  The conditional
 * update makes concurrent first visits converge on one session: a losing
 * request may have created an unused OpenCode session, but it cannot replace
 * the conversation the other chef is already using.
 */
export async function claimSharedOpencodeSession(
	db: D1Database,
	appId: string,
	opencodeSessionId: string
) {
	const result = await db
		.prepare(
			`UPDATE apps SET sandbox_id = ?, opencode_session_id = ?, sandbox_state = 'running', updated_at = ?
			 WHERE id = ? AND opencode_session_id IS NULL`
		)
		.bind(appId, opencodeSessionId, now(), appId)
		.run();
	return result.meta.changes === 1;
}

export async function markSandboxDestroyed(db: D1Database, appId: string) {
	await db
		.prepare(
			`UPDATE apps SET sandbox_id = NULL, opencode_session_id = NULL, sandbox_state = 'destroyed', updated_at = ?
			 WHERE id = ?`
		)
		.bind(now(), appId)
		.run();
}

export async function listKitchenMembers(db: D1Database, kitchenId: string) {
	const result = await db
		.prepare(
			`SELECT u.id, u.name, u.email, km.role
			 FROM kitchen_memberships km JOIN "user" u ON u.id = km.user_id
			 WHERE km.kitchen_id = ? ORDER BY km.created_at`
		)
		.bind(kitchenId)
		.all<{ id: string; name: string; email: string; role: KitchenRole }>();
	return result.results;
}

const INVITATION_TTL_SECONDS = 60 * 60 * 24 * 7;

export async function createInvitation(
	db: D1Database,
	actor: UserIdentity,
	options: {
		organisationId: string;
		kitchenId?: string;
		email: string;
		organisationRole: OrganisationRole;
		kitchenRole?: KitchenRole;
	}
) {
	const email = options.email.trim().toLowerCase();
	if (!email.includes('@')) throw new Error('Enter a valid email address.');

	const orgRole = await getOrganisationRole(db, actor.id, options.organisationId);
	if (orgRole !== 'owner') {
		if (!options.kitchenId) throw new Error('Only an organisation owner can invite at organisation scope.');
		const kitchenAccess = await getKitchenAccess(db, actor.id, options.kitchenId);
		if (!kitchenAccess || kitchenAccess.role !== 'head_chef') {
			throw new Error('Only an organisation owner or Head Chef can send this invitation.');
		}
	}

	const id = crypto.randomUUID();
	const token = crypto.randomUUID() + crypto.randomUUID();
	const tokenHash = await hashToken(token);
	const timestamp = now();
	const expiresAt = new Date(Date.now() + INVITATION_TTL_SECONDS * 1000).toISOString();

	await db
		.prepare(
			`INSERT INTO invitations
			 (id, organisation_id, kitchen_id, email, organisation_role, kitchen_role, token_hash, expires_at, created_by, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			id,
			options.organisationId,
			options.kitchenId ?? null,
			email,
			options.organisationRole,
			options.kitchenRole ?? null,
			tokenHash,
			expiresAt,
			actor.id,
			timestamp
		)
		.run();

	await recordActivity(db, options.organisationId, actor.id, 'invitation', id, 'created');
	return { id, token };
}

export async function listPendingInvitations(db: D1Database, organisationId: string) {
	const result = await db
		.prepare(
			`SELECT i.id, i.email, i.kitchen_id AS kitchenId, k.name AS kitchenName,
			 i.organisation_role AS organisationRole, i.kitchen_role AS kitchenRole, i.expires_at AS expiresAt
			 FROM invitations i LEFT JOIN kitchens k ON k.id = i.kitchen_id
			 WHERE i.organisation_id = ? AND i.accepted_at IS NULL AND i.revoked_at IS NULL
			 ORDER BY i.created_at DESC`
		)
		.bind(organisationId)
		.all<{
			id: string;
			email: string;
			kitchenId: string | null;
			kitchenName: string | null;
			organisationRole: OrganisationRole;
			kitchenRole: KitchenRole | null;
			expiresAt: string;
		}>();
	return result.results;
}

export async function revokeInvitation(db: D1Database, actor: UserIdentity, invitationId: string) {
	const invitation = await db
		.prepare('SELECT organisation_id AS organisationId FROM invitations WHERE id = ?')
		.bind(invitationId)
		.first<{ organisationId: string }>();
	if (!invitation) throw new Error('Invitation not found.');
	const role = await getOrganisationRole(db, actor.id, invitation.organisationId);
	if (role !== 'owner') throw new Error('Only an organisation owner can revoke this invitation.');

	await db
		.prepare('UPDATE invitations SET revoked_at = ? WHERE id = ?')
		.bind(now(), invitationId)
		.run();
	await recordActivity(db, invitation.organisationId, actor.id, 'invitation', invitationId, 'revoked');
}

export async function getInvitationByToken(db: D1Database, token: string) {
	const tokenHash = await hashToken(token);
	return db
		.prepare(
			`SELECT i.id, i.email, i.organisation_id AS organisationId, o.name AS organisationName,
			 i.kitchen_id AS kitchenId, k.name AS kitchenName,
			 i.organisation_role AS organisationRole, i.kitchen_role AS kitchenRole,
			 i.expires_at AS expiresAt, i.accepted_at AS acceptedAt, i.revoked_at AS revokedAt
			 FROM invitations i
			 JOIN organisations o ON o.id = i.organisation_id
			 LEFT JOIN kitchens k ON k.id = i.kitchen_id
			 WHERE i.token_hash = ?`
		)
		.bind(tokenHash)
		.first<{
			id: string;
			email: string;
			organisationId: string;
			organisationName: string;
			kitchenId: string | null;
			kitchenName: string | null;
			organisationRole: OrganisationRole;
			kitchenRole: KitchenRole | null;
			expiresAt: string;
			acceptedAt: string | null;
			revokedAt: string | null;
		}>();
}

export async function acceptInvitation(db: D1Database, user: UserIdentity, token: string) {
	const invitation = await getInvitationByToken(db, token);
	if (!invitation) throw new Error('That invitation link is invalid.');
	if (invitation.revokedAt) throw new Error('That invitation has been revoked.');
	if (invitation.acceptedAt) throw new Error('That invitation has already been accepted.');
	if (new Date(invitation.expiresAt).getTime() < Date.now()) throw new Error('That invitation has expired.');
	if (invitation.email !== user.email.trim().toLowerCase()) {
		throw new Error(`This invitation was sent to ${invitation.email}. Sign in with that address to accept it.`);
	}

	const timestamp = now();
	const statements = [
		db.prepare('UPDATE invitations SET accepted_at = ? WHERE id = ?').bind(timestamp, invitation.id),
		db
			.prepare(
				`INSERT INTO organisation_memberships (organisation_id, user_id, role, created_at)
				 VALUES (?, ?, ?, ?)
				 ON CONFLICT (organisation_id, user_id) DO NOTHING`
			)
			.bind(invitation.organisationId, user.id, invitation.organisationRole, timestamp)
	];
	if (invitation.kitchenId && invitation.kitchenRole) {
		statements.push(
			db
				.prepare(
					`INSERT INTO kitchen_memberships (kitchen_id, user_id, role, created_at)
					 VALUES (?, ?, ?, ?)
					 ON CONFLICT (kitchen_id, user_id) DO UPDATE SET role = excluded.role`
				)
				.bind(invitation.kitchenId, user.id, invitation.kitchenRole, timestamp)
		);
	}
	await db.batch(statements);
	await recordActivity(db, invitation.organisationId, user.id, 'invitation', invitation.id, 'accepted');
	return { organisationId: invitation.organisationId, kitchenId: invitation.kitchenId };
}

export async function getAppAccess(db: D1Database, userId: string, appId: string) {
	return db
		.prepare(
			`SELECT a.id, a.name, a.kitchen_id AS kitchenId, k.name AS kitchenName, a.git_branch AS gitBranch,
			 a.sandbox_id AS sandboxId, a.opencode_session_id AS opencodeSessionId,
			 k.default_model_id AS defaultModelId, k.default_model_provider_id AS defaultModelProviderId,
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
			kitchenName: string;
			gitBranch: string;
			sandboxId: string | null;
			opencodeSessionId: string | null;
			defaultModelId: string | null;
			defaultModelProviderId: string | null;
			role: KitchenRole;
		}>();
}

export async function renameApp(db: D1Database, actor: UserIdentity, appId: string, name: string) {
	const trimmed = name.trim();
	if (!trimmed) throw new Error('App name is required.');
	const app = await getAppAccess(db, actor.id, appId);
	if (!app) throw new Error('You do not have access to this app.');
	await db.prepare('UPDATE apps SET name = ?, updated_at = ? WHERE id = ?').bind(trimmed, now(), appId).run();
	const kitchen = await getKitchenAccess(db, actor.id, app.kitchenId);
	if (kitchen) await recordActivity(db, kitchen.organisationId, actor.id, 'app', appId, 'renamed');
	return { id: appId, name: trimmed };
}

/**
 * A profile view of another user's Kitchens and apps, scoped to what the
 * viewer can already see. The target's own kitchen list is never trusted as
 * authority — each kitchen is re-checked against the viewer's own access
 * (`getKitchenAccess`) before its apps are included, so this can never leak
 * an app the viewer couldn't otherwise reach directly.
 */
export async function getUserProfile(db: D1Database, viewerId: string, targetUserId: string) {
	const target = await db
		.prepare('SELECT id, name, email FROM "user" WHERE id = ?')
		.bind(targetUserId)
		.first<{ id: string; name: string; email: string }>();
	if (!target) return null;

	const targetKitchens = await db
		.prepare(
			`SELECT DISTINCT k.id, k.name
			 FROM kitchens k
			 LEFT JOIN kitchen_memberships km ON km.kitchen_id = k.id
			 LEFT JOIN organisation_memberships om ON om.organisation_id = k.organisation_id
			 WHERE km.user_id = ? OR (om.user_id = ? AND om.role = 'owner')
			 ORDER BY k.created_at`
		)
		.bind(targetUserId, targetUserId)
		.all<{ id: string; name: string }>();

	const kitchens: Array<{
		id: string;
		name: string;
		apps: Array<{ id: string; name: string; sandboxState: string; updatedAt: string }>;
	}> = [];
	for (const kitchen of targetKitchens.results) {
		const viewerAccess = await getKitchenAccess(db, viewerId, kitchen.id);
		if (!viewerAccess) continue;
		const apps = await listApps(db, viewerId, kitchen.id);
		kitchens.push({ id: kitchen.id, name: kitchen.name, apps });
	}

	return { user: target, kitchens };
}

/** Only a Kitchen's Head Chef may set the default model every app in that Kitchen starts with. `model: null` clears the override, falling back to the platform default (Luna). */
export async function setKitchenDefaultModel(
	db: D1Database,
	actorId: string,
	kitchenId: string,
	model: { id: string; providerID: string } | null
) {
	const kitchen = await getKitchenAccess(db, actorId, kitchenId);
	if (!kitchen) throw new Error('You do not have access to this Kitchen.');
	if (kitchen.role !== 'head_chef') throw new Error('Only the Head Chef can change this Kitchen\'s default model.');
	await db
		.prepare('UPDATE kitchens SET default_model_id = ?, default_model_provider_id = ? WHERE id = ?')
		.bind(model?.id ?? null, model?.providerID ?? null, kitchenId)
		.run();
}
