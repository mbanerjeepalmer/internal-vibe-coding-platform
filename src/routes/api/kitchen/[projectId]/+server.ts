import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSandboxProvider } from '$lib/server/opencode/sandbox';
import { requireAppAccess } from '$lib/server/authz';
import { markSandboxDestroyed } from '$lib/server/control-plane';

// Tears down the app's sandbox entirely (kills the local process, or deletes
// the Daytona sandbox) so a fresh run starts clean. Retains the durable App
// record, per docs/05_wrapping.md's basic lifecycle.
export const DELETE: RequestHandler = async (event) => {
	const { db, app } = await requireAppAccess(event);
	await getSandboxProvider().destroySandbox(app.id);
	await markSandboxDestroyed(db, app.id);
	return json({ ok: true });
};
