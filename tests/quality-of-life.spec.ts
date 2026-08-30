import { test, expect } from '@playwright/test';

// Runs as the dev chef identity provisioned by tests/auth.setup.ts (see
// tests/helpers/dev-session.ts for how that identity gets a real session
// without a magic-link email). Each test uses a name unique to this run so
// repeated local runs don't collide with kitchens/apps left by earlier ones.
//
// Serial, not parallel: every test in this file mutates the same shared
// dev-chef account (its display name, its kitchens) — running them
// concurrently races writes to that one user row.
test.describe.configure({ mode: 'serial' });

const runId = Date.now().toString(36);

test('kitchen and app names link where the breadcrumb says they do', async ({ page }) => {
	const kitchenName = `QoL Kitchen ${runId}`;
	const appName = `QoL App ${runId}`;

	await page.goto('/home');
	// These toggle buttons only work once Svelte's client JS has hydrated;
	// retry the click until the form it reveals actually shows up, rather
	// than racing a plain click against hydration.
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
	await expect(page.getByText(kitchenName)).toBeVisible();

	await expect(async () => {
		await page.getByRole('button', { name: '+ New app' }).click();
		await expect(page.getByPlaceholder('App name')).toBeVisible({ timeout: 1000 });
	}).toPass({ timeout: 10000 });
	await page.getByPlaceholder('App name').fill(appName);
	await page.getByRole('button', { name: 'Create' }).click();
	await expect(page).toHaveURL(/\/apps\//);

	// Breadcrumb: kitchen name links back to the kitchen, app name is the
	// inline-rename control.
	const breadcrumbKitchenLink = page.getByRole('banner').getByRole('link', { name: kitchenName });
	await expect(breadcrumbKitchenLink).toBeVisible();
	const appNameButton = page.getByRole('banner').getByRole('button', { name: appName });
	await expect(appNameButton).toBeVisible();

	// Renaming from the breadcrumb persists across a reload.
	const renamed = `${appName} renamed`;
	await appNameButton.click();
	const appNameInput = page.getByRole('banner').locator('input');
	await appNameInput.fill(renamed);
	const renameRequest = page.waitForResponse((res) => res.url().includes('?/rename'));
	await appNameInput.blur();
	await expect(page.getByRole('banner').getByRole('button', { name: renamed })).toBeVisible();
	await renameRequest;

	await page.reload();
	await expect(page.getByRole('banner').getByRole('button', { name: renamed })).toBeVisible();

	await breadcrumbKitchenLink.click();
	await expect(page).toHaveURL(/\/kitchens\//);
	await expect(page.getByRole('link', { name: renamed })).toBeVisible();
});

test('a user can change their display name from /account', async ({ page }) => {
	const newName = `E2E Dev Chef ${runId}`;

	await page.goto('/account');
	const nameField = page.getByLabel('Display name');
	await nameField.fill(newName);
	await expect(async () => {
		await page.getByRole('button', { name: 'Save' }).click();
		await expect(page.getByText('Saved.')).toBeVisible({ timeout: 1000 });
	}).toPass({ timeout: 10000 });

	await page.goto('/home');
	await expect(page.getByRole('link', { name: newName })).toBeVisible();
});

test('a user profile page lists the apps its owner has access to', async ({ page }) => {
	await page.goto('/home');
	const profileLink = page.locator('header').getByRole('link').first();
	await profileLink.click();
	await expect(page).toHaveURL(/\/users\//);
	await expect(page.getByRole('heading', { name: 'Apps' })).toBeVisible();
});
