import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAppAccess } from '$lib/server/authz';
import { effectiveKitchenSecrets } from '$lib/server/secrets';
import { createGitHubPullRequest, validatePullRequest } from '$lib/server/github-pull-request';

/** Explicit user action; GitHub credentials remain in the control plane. */
export const POST: RequestHandler = async (event) => {
	const { db, app } = await requireAppAccess(event);
	if (app.role !== 'head_chef') throw error(403, 'Only a Head Chef can create a pull request.');
	const reader = event.request.body?.getReader();
	if (!reader) throw error(400, 'Missing pull request details.');
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > 70000) { await reader.cancel(); throw error(413, 'Request is too large.'); }
			chunks.push(value);
		}
	} finally { reader.releaseLock(); }
	const data = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
	let input;
	try { input = validatePullRequest(JSON.parse(new TextDecoder().decode(data))); }
	catch (e) { throw error(400, e instanceof SyntaxError ? 'Invalid JSON.' : e instanceof Error ? e.message : 'Invalid request.'); }
	const tokenRow = await db.prepare("SELECT agent_visible AS agentVisible FROM secrets WHERE kitchen_id = ? AND name = 'GITHUB_TOKEN'")
		.bind(app.kitchenId).first<{ agentVisible: number }>();
	if (!tokenRow || tokenRow.agentVisible) throw error(400, 'Set a Kitchen GITHUB_TOKEN with agent access turned off.');
	const token = (await effectiveKitchenSecrets(db, app.kitchenId, event.platform?.env.SECRET_ENCRYPTION_KEY)).GITHUB_TOKEN;
	if (!token || /[\r\n]/.test(token)) throw error(503, 'The GitHub token is invalid.');
	try { return json(await createGitHubPullRequest(input, token), { status: 201 }); }
	catch (e) {
		// Never surface raw provider responses or credentials.
		const message = e instanceof Error && /^GitHub (could not create|returned an invalid)/.test(e.message) ? e.message : 'GitHub request failed. Check access or try again later.';
		throw error(502, message);
	}
};
