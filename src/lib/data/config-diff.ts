export const kitchenConfig = [
	{ label: 'Testing', value: 'Red/Green TDD required, Playwright pyramid on every project' },
	{ label: 'Observability', value: 'PostHog + Sentry wired into every project automatically' },
	{ label: 'Deploy target', value: 'Cloudflare Workers, one click from the build session' }
];

export const proposedChange = {
	title: "Block Node.js-only imports before a Cloudflare deploy",
	body: "Add a pre-deploy check that rejects imports of fs, path, or net — the class of dependency that crashed maps-alternative. Catches it before deploy instead of in production.",
	proposedBy: 'Alexandra'
};
