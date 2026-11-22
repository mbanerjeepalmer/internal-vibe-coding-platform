import { test, expect } from '@playwright/test';

// Runs as the dev chef identity provisioned by tests/auth.setup.ts.
// Covers only the platform-side pieces that don't need a live Cloudflare
// Zero Trust account: the sidebar panel's guard copy before a first
// deploy, and the same guard enforced server-side (the UI hiding the form
// is not the actual security boundary — the API is). The real Cloudflare
// Access sync (creating the Application, pushing allow-list policies) can
// only be verified against a real deployed Worker — see the plan's manual
// verification steps.
test.describe.configure({ mode: 'serial' });

const runId = Date.now().toString(36);

test('the App access panel guards against configuring rules before a first deploy', async ({ page, request }) => {
	const kitchenName = `Access Kitchen ${runId}`;
	const appName = `Access App ${runId}`;

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

	// Opening the panel before any deploy shows the guard copy, not an
	// add-rule form — there's no Worker yet for Cloudflare to protect.
	await page.getByRole('button', { name: 'App access' }).click();
	await expect(page.getByText('Deploy this app at least once before configuring access rules.')).toBeVisible();

	// The API enforces the same guard directly.
	const createResponse = await request.post(`/api/kitchen/${appId}/access-rules`, {
		headers: { accept: 'application/json' },
		data: { ruleType: 'email', value: 'abc@example.com' }
	});
	expect(createResponse.status()).toBe(400);
	expect((await createResponse.json()).message).toContain('Deploy the app');

	// Listing rules for a fresh app is always safe, even pre-deploy.
	const listResponse = await request.get(`/api/kitchen/${appId}/access-rules`);
	expect(listResponse.ok()).toBe(true);
	expect(await listResponse.json()).toEqual([]);

	// Neither deployment operation may hand platform credentials to code in
	// an agent-controlled workspace. They remain disabled until a trusted
	// deployment pipeline exists; this must hold even for an authorised user.
	for (const response of [
		await request.post(`/api/kitchen/${appId}/deploy`),
		await request.delete(`/api/kitchen/${appId}/deploy`)
	]) {
		expect(response.status()).toBe(503);
		const body = await response.json();
		expect(body.success).toBe(false);
		expect(body.log).toContain('temporarily disabled');
	}

	// Prototype deployment is disabled by default, even for a Head Chef.
	const invalidPrototype = await request.post(`/api/kitchen/${appId}/prototype-deploy`, {
		data: { moduleSource: '' }
	});
	expect(invalidPrototype.status()).toBe(503);
});
