import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSandboxProvider } from '$lib/server/opencode/sandbox';
import { requireAppAccess } from '$lib/server/authz';
import { markSourceSaved } from '$lib/server/control-plane';
import { saveAppSource } from '$lib/server/app-source';

// A manual checkpoint — alongside the automatic saves on deploy and sandbox
// teardown — for a chef who wants to be sure recent work is persisted right
// now (see AGENTS.md's wrapper step 3 / src/lib/server/app-source.ts).
export const POST: RequestHandler = async (event) => {
	const { db, app } = await requireAppAccess(event);
	const bucket = event.platform?.env.APP_SOURCE;
	if (!bucket) throw error(500, 'Cloudflare R2 is required for source persistence.');
	await saveAppSource(bucket, app.id, getSandboxProvider());
	await markSourceSaved(db, app.id);
	return json({ savedAt: new Date().toISOString() });
};
