import { test } from 'node:test';
import assert from 'node:assert/strict';
import { githubDiscoveryPath } from '../../src/lib/server/github-discovery.ts';

test('builds bounded, paginated repository and branch discovery paths', () => {
	assert.equal(githubDiscoveryPath(null, 2), '/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member&page=2');
	assert.equal(githubDiscoveryPath('owner/repo.name', 3), '/repos/owner/repo.name/branches?per_page=100&page=3');
});

test('rejects external hosts, malformed repositories and invalid pages', () => {
	for (const name of ['https://evil.example/x', '../repo', 'owner/repo?x=y', 'owner/repo/extra']) {
		assert.throws(() => githubDiscoveryPath(name, 1), /Invalid repository/);
	}
	for (const page of [0, -1, 1.5, 1001, NaN]) assert.throws(() => githubDiscoveryPath(null, page), /Invalid page/);
});
