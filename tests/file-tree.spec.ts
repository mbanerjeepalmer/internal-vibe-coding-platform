import { test, expect } from '@playwright/test';

// Runs as the dev chef identity provisioned by tests/auth.setup.ts.
// Covers only the platform-side path-safety guard on the file-tree/upload
// API — the guard runs before the route ever touches a project's sandbox
// (see files/+server.ts's `parsePath`), so this doesn't need a live opencode
// sandbox to exercise. Listing/uploading against a real sandbox is exercised
// manually (see the plan) since it needs `opencode serve` (or a Daytona
// sandbox) actually running.
test.describe.configure({ mode: 'serial' });

const runId = Date.now().toString(36);

test('the files API rejects path traversal before touching the sandbox', async ({ page, request }) => {
	const kitchenName = `Files Kitchen ${runId}`;
	const appName = `Files App ${runId}`;

	await page.goto('/home');
	await expect(async () => {
		await page.getByRole('button', { name: '+ New Kitchen' }).click();
		await expect(page.getByPlaceholder('Kitchen name')).toBeVisible({ timeout: 1000 });
	}).toPass({ timeout: 10000 });
	await page.getByPlaceholder('Kitchen name').fill(kitchenName);
	await page.getByRole('button', { name: 'Create' }).click();

	const kitchenLink = page.getByRole('link', { name: kitchenName });
	await expect(kitchenLink).toBeVisible();
	await kitchenLink.click();
	await expect(page).toHaveURL(/\/kitchens\//);

	await expect(async () => {
		await page.getByRole('button', { name: '+ New app' }).click();
		await expect(page.getByPlaceholder('App name')).toBeVisible({ timeout: 1000 });
	}).toPass({ timeout: 10000 });
	await page.getByPlaceholder('App name').fill(appName);
	await page.getByRole('button', { name: 'Create' }).click();
	await expect(page).toHaveURL(/\/apps\//);

	const appId = new URL(page.url()).pathname.split('/apps/')[1];

	// A `..` segment anywhere in the listing path is rejected outright.
	const listResponse = await request.get(`/api/kitchen/${appId}/files?path=../../etc`);
	expect(listResponse.status()).toBe(400);

	// Same for the upload destination directory. SvelteKit's CSRF guard
	// rejects a form-encoded POST without a matching `origin` header (a real
	// browser's `fetch` sets this automatically) — set it explicitly since
	// this is Playwright's bare request context, not a page navigation.
	const origin = new URL(page.url()).origin;
	const form = new FormData();
	form.set('path', '../../etc');
	form.set('file', new Blob(['hello']), 'hello.txt');
	const uploadResponse = await request.post(`/api/kitchen/${appId}/files`, {
		multipart: form as never,
		headers: { origin }
	});
	expect(uploadResponse.status()).toBe(400);

	// A malicious file name is rejected even with a valid destination directory.
	const form2 = new FormData();
	form2.set('path', '');
	form2.set('file', new Blob(['hello']), '../escaped.txt');
	const uploadResponse2 = await request.post(`/api/kitchen/${appId}/files`, {
		multipart: form2 as never,
		headers: { origin }
	});
	expect(uploadResponse2.status()).toBe(400);

	// A request from an app this dev chef doesn't belong to still 404s, same
	// as every other /api/kitchen/[projectId]/** route.
	const notFoundResponse = await request.get(`/api/kitchen/not-a-real-app/files`);
	expect(notFoundResponse.status()).toBe(404);
});
