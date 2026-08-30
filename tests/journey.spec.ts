import { test, expect } from '@playwright/test';

test('full v0.1 hardcoded demo journey', async ({ page }) => {
	// Accept the invite email
	await page.goto('/');
	await page.getByRole('link', { name: 'Accept invitation' }).click();

	// Log in as Alexandra
	await expect(page).toHaveURL(/\/login\?as=alexandra/);
	await page.getByRole('link', { name: 'Log in as Alexandra' }).click();
	await expect(page).toHaveURL(/\/chat$/);

	// Build session: attach spec, answer questions, provide API key
	await page.getByTestId('attach-file').click();
	await page.getByTestId('send-spec').click();
	await page.getByTestId('answer-questions').click();
	await page.getByTestId('api-key-input').fill('AIzaSyTestKey1234');
	await page.getByTestId('submit-api-key').click();

	await expect(page.getByTestId('app-preview')).toBeVisible();

	// Give feedback and see the preview update
	await page.getByTestId('send-feedback').click();
	await expect(page.getByTestId('emoji-pin')).toBeVisible();

	// Deploy -> crash
	await page.getByTestId('deploy-button').click();
	await expect(page).toHaveURL(/\/deployed$/);
	await expect(page.getByText('Application error')).toBeVisible();

	// Back to the platform, dig into the crash, fix it
	await page.getByTestId('back-to-platform').click();
	await expect(page).toHaveURL(/\/fix$/);

	await page.getByTestId('open-sentry').click();
	await expect(page.getByTestId('sentry-panel')).toBeVisible();
	await page.getByTestId('open-posthog').click();
	await expect(page.getByTestId('posthog-panel')).toBeVisible();

	await page.getByTestId('fix-it').click();
	await page.getByTestId('view-parent-config').click();
	await expect(page).toHaveURL(/\/config$/);

	// Propose a change to the parent config
	await page.getByTestId('propose-change').click();
	await expect(page.getByTestId('proposed-status')).toBeVisible();

	// Log out, log in as Maurice
	await page.getByTestId('log-in-as-maurice').click();
	await expect(page).toHaveURL(/\/login\?as=maurice/);
	await page.getByRole('link', { name: 'Log in as Maurice' }).click();
	await expect(page).toHaveURL(/\/dashboard$/);

	// Review Alexandra's project and proposed change, tighten her permissions
	await page.getByTestId('chef-alexandra').click();
	await expect(page).toHaveURL(/\/dashboard\/alexandra$/);

	await page.getByTestId('approve-change').click();
	await expect(page.getByTestId('decision-status')).toHaveText(/Approved/);

	await page.getByTestId('require-approval-toggle').click();
	await expect(page.getByTestId('approval-confirmation')).toBeVisible();
});
