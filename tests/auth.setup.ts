import { test as setup } from '@playwright/test';
import { provisionDevSession } from './helpers/dev-session';

const AUTH_FILE = 'playwright/.auth/dev-chef.json';

// Runs once before the rest of the suite (see the `setup` project in
// playwright.config.ts). Logs in as a deterministic dev-only identity —
// see tests/helpers/dev-session.ts for why this can skip the real
// magic-link email flow — and saves the authenticated browser state for
// every other project to reuse via `storageState`.
setup('authenticate as a dev chef', async ({ page, baseURL }) => {
	const { cookie } = await provisionDevSession({
		userId: 'e2e-dev-chef',
		name: 'E2E Dev Chef',
		email: 'e2e-dev-chef@example.com'
	});

	await page.context().addCookies([
		{
			name: cookie.name,
			value: cookie.value,
			url: baseURL
		}
	]);

	// Confirms the cookie actually authenticates before the rest of the
	// suite relies on it — a bad signature or expired token would otherwise
	// surface later as a confusing redirect-to-signin in an unrelated test.
	await page.goto('/home');
	await page.waitForURL('/home');

	await page.context().storageState({ path: AUTH_FILE });
});
