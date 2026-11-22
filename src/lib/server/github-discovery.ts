/** Build a GitHub API path without allowing callers to select a different host. */
export function githubDiscoveryPath(repository: string | null, page: number): string {
	if (!Number.isSafeInteger(page) || page < 1 || page > 1000) throw new Error('Invalid page.');
	if (repository === null) return `/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member&page=${page}`;
	if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9_.-]{1,100}$/.test(repository)) throw new Error('Invalid repository.');
	const [owner, name] = repository.split('/');
	return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/branches?per_page=100&page=${page}`;
}
