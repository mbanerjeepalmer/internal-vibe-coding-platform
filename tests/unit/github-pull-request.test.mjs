import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePullRequest, createGitHubPullRequest } from '../../src/lib/server/github-pull-request.ts';

const input = { repository: 'owner/repo', head: 'feature/one', base: 'main', title: ' Update ', body: 'Details' };
test('creates only a same-repository PR through the GitHub API', async () => {
	const result = await createGitHubPullRequest(input, 'example-token', async (url, options) => {
		assert.equal(url, 'https://api.github.com/repos/owner/repo/pulls');
		assert.equal(options.redirect, 'error');
		assert.equal(options.headers.Authorization, 'Bearer example-token');
		assert.deepEqual(JSON.parse(options.body), { head: 'feature/one', base: 'main', title: 'Update', body: 'Details' });
		return Response.json({ number: 42, html_url: 'https://github.com/owner/repo/pull/42' });
	});
	assert.deepEqual(result, { number: 42, url: 'https://github.com/owner/repo/pull/42' });
});
test('rejects cross-repository refs and unsafe response links', async () => {
	for (const head of ['someone:branch', '../main', 'a b', '.hidden', 'a//b']) assert.throws(() => validatePullRequest({ ...input, head }));
	assert.throws(() => validatePullRequest({ ...input, head: 'main' }));
	assert.throws(() => validatePullRequest({ ...input, repository: 'https://attacker.example/repo' }));
	await assert.rejects(createGitHubPullRequest(input, 'example-token', async () => Response.json({ number: 1, html_url: 'https://attacker.example/' })), /invalid pull request URL/);
});
test('provider error details are not returned', async () => {
	await assert.rejects(createGitHubPullRequest(input, 'example-token', async () => new Response('private token and provider details', { status: 403 })), (err) => {
		assert.match(err.message, /HTTP 403/);
		assert.doesNotMatch(err.message, /private token/);
		return true;
	});
});
