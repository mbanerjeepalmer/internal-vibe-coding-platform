import { createAuthClient } from 'better-auth/svelte';
import { magicLinkClient } from 'better-auth/client/plugins';

/** Browser client for the Better Auth routes mounted at /api/auth. */
export const authClient = createAuthClient({
	plugins: [magicLinkClient()]
});
