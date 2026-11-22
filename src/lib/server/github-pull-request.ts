export type PullRequestInput = { repository: string; head: string; base: string; title: string; body: string };

// GitHub branch names cannot contain whitespace, control characters, '..',
// or a refspec colon. In particular, forbid `owner:branch`: this endpoint
// only opens PRs between branches of the selected repository.
function validBranch(value: string): boolean {
	return value.length > 0 && value.length <= 200 && !/[\s~^:?*\[\\\x00-\x1f\x7f]/.test(value) &&
		!value.includes('..') && !value.includes('@{') && !value.includes('//') &&
		!value.startsWith('/') && !value.endsWith('/') && !value.endsWith('.') &&
		value.split('/').every((part) => part && !part.startsWith('.') && !part.endsWith('.lock'));
}

export function validatePullRequest(value: unknown): PullRequestInput {
	if (!value || typeof value !== 'object') throw new Error('Invalid pull request.');
	const input = value as Record<string, unknown>;
	const { repository, head, base, title, body = '' } = input;
	if (typeof repository !== 'string' || !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9_.-]{1,100}$/.test(repository)) throw new Error('Invalid repository.');
	if (typeof head !== 'string' || typeof base !== 'string' || !validBranch(head) || !validBranch(base) || head === base) throw new Error('Choose two different valid branch names.');
	if (typeof title !== 'string' || !title.trim() || title.length > 256 || /[\r\n]/.test(title)) throw new Error('Enter a title of at most 256 characters.');
	if (typeof body !== 'string' || body.length > 65536) throw new Error('Pull request description is too long.');
	return { repository, head, base, title: title.trim(), body };
}

export async function createGitHubPullRequest(input: PullRequestInput, token: string, request: typeof fetch = fetch) {
	const { repository, head, base, title, body } = validatePullRequest(input);
	if (!token || /[\r\n]/.test(token)) throw new Error('Invalid GitHub token.');
	const [owner, name] = repository.split('/');
	const response = await request(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls`, {
		method: 'POST', redirect: 'error',
		headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'vibe-kitchen', 'X-GitHub-Api-Version': '2022-11-28' },
		body: JSON.stringify({ head, base, title, body })
	});
	if (!response.ok) throw new Error(`GitHub could not create the pull request (HTTP ${response.status}). Check repository access, branch names and whether a pull request already exists.`);
	const result = await response.json() as { number?: unknown; html_url?: unknown };
	if (!Number.isSafeInteger(result.number) || Number(result.number) < 1 || typeof result.html_url !== 'string') throw new Error('GitHub returned an invalid pull request.');
	// Do not return untrusted links or a provider response containing secrets.
	const expected = `https://github.com/${repository}/pull/${result.number}`;
	if (result.html_url.toLowerCase() !== expected.toLowerCase()) throw new Error('GitHub returned an invalid pull request URL.');
	return { number: result.number as number, url: expected };
}
