import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSandboxProvider } from '$lib/server/opencode/sandbox';

// The "hard delete this app afterwards" flow from docs/01_hardcoded_demo.md —
// tears down the project's sandbox entirely (kills the local process, or
// deletes the Daytona sandbox) so a fresh run starts clean.
export const DELETE: RequestHandler = async ({ params }) => {
	await getSandboxProvider().destroySandbox(params.projectId);
	return json({ ok: true });
};
