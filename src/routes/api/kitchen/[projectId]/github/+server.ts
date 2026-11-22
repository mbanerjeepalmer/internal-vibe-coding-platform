import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAppAccess } from '$lib/server/authz';
import { effectiveKitchenSecrets } from '$lib/server/secrets';
import { githubDiscoveryPath } from '$lib/server/github-discovery';

// Read-only discovery. The token is a Kitchen secret which must not be sent
// to the sandbox; only a Head Chef can use it to enumerate repositories.
export const GET: RequestHandler = async (event) => {
	const { db, app } = await requireAppAccess(event);
	if (app.role !== 'head_chef') throw error(403, 'Only a Head Chef can browse the GitHub connection.');
	const tokenRow = await db.prepare("SELECT agent_visible AS agentVisible FROM secrets WHERE kitchen_id = ? AND name = 'GITHUB_TOKEN'")
		.bind(app.kitchenId).first<{ agentVisible: number }>();
	if (!tokenRow) throw error(503, 'Add GITHUB_TOKEN as a Kitchen secret with agent access turned off.');
	if (tokenRow.agentVisible) throw error(400, 'Turn off agent access for the Kitchen GITHUB_TOKEN before using this connection.');
	const secrets = await effectiveKitchenSecrets(db, app.kitchenId, event.platform?.env.SECRET_ENCRYPTION_KEY);
	const token = secrets.GITHUB_TOKEN;
	if (!token || /[\r\n]/.test(token)) throw error(503, 'The GitHub token is invalid; replace the Kitchen GITHUB_TOKEN.');

	const repo = event.url.searchParams.get('repository');
	const pageText = event.url.searchParams.get('page') ?? '1';
	if (!/^[1-9]\d{0,3}$/.test(pageText)) throw error(400, 'Invalid page.');
	let path: string;
	try { path = githubDiscoveryPath(repo, Number(pageText)); }
	catch { throw error(400, 'Invalid repository or page.'); }
	const response = await fetch(`https://api.github.com${path}`, {
		headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'vibe-kitchen', 'X-GitHub-Api-Version': '2022-11-28' },
		redirect: 'error'
	});
	if (!response.ok) {
		if (response.status === 401) throw error(401, 'GitHub rejected the token. Check or replace it.');
		if (response.status === 404) throw error(404, 'Repository not found or the token cannot access it.');
		throw error(502, `GitHub request failed (${response.status}). Check access or try again later.`);
	}
	const items = await response.json() as Array<Record<string, unknown>>;
	if (!Array.isArray(items)) throw error(502, 'Unexpected response from GitHub.');
	const hasMore = (response.headers.get('link') ?? '').includes('rel="next"');
	if (repo !== null) return json({ branches: items.map((item) => ({ name: item.name })), hasMore });
	return json({ repositories: items.map((item) => ({ fullName: item.full_name, private: item.private, defaultBranch: item.default_branch })), hasMore });
};
