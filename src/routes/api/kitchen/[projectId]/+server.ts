import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSandboxProvider } from '$lib/server/opencode/sandbox';
import { requireAppAccess } from '$lib/server/authz';
import { markSandboxDestroyed, markSourceSaved } from '$lib/server/control-plane';
import { saveAppSource } from '$lib/server/app-source';

// Tears down the app's sandbox entirely (kills the local process, or deletes
// the Daytona sandbox) so a fresh run starts clean. Retains the durable App
// record, per docs/05_wrapping.md's basic lifecycle.
export const DELETE: RequestHandler = async (event) => {
	const { db, app } = await requireAppAccess(event);
	// Best-effort: a sandbox this app server never actually provisioned (e.g.
	// already destroyed, or never started) has nothing to export — don't let
	// that block tearing it down.
	const bucket = event.platform?.env.APP_SOURCE;
	if (bucket) {
		try {
			await saveAppSource(bucket, app.id, getSandboxProvider());
			await markSourceSaved(db, app.id);
		} catch (err) {
			console.error(`Could not save ${app.id}'s source before destroying its sandbox`, err);
		}
	}
	await getSandboxProvider().destroySandbox(app.id);
	await markSandboxDestroyed(db, app.id);
	return json({ ok: true });
};
