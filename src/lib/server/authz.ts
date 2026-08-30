import { error } from '@sveltejs/kit';
import { getAppAccess } from './control-plane';

/**
 * Every /api/kitchen/[projectId]/** route is called directly by the browser
 * with a raw route id, so this is the actual enforcement boundary (see
 * docs/05_wrapping.md's "Enforcement boundary" section) — the id must never
 * be trusted as authority on its own.
 */
export async function requireAppAccess(event: {
	platform?: App.Platform;
	locals: App.Locals;
	params: { projectId?: string };
}) {
	const db = event.platform?.env.DB;
	if (!db) throw error(500, 'Cloudflare D1 is required for the control plane.');
	if (!event.locals.user) throw error(401, 'Sign in required.');
	const appId = event.params.projectId;
	if (!appId) throw error(400, 'Missing app id.');
	const app = await getAppAccess(db, event.locals.user.id, appId);
	if (!app) throw error(404, 'App not found.');
	return { db, user: event.locals.user, app };
}
