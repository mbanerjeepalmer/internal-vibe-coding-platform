import type { Handle } from '@sveltejs/kit';
import { createAuth, type AuthEnv } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = null;
	event.locals.session = null;

	if (event.platform?.env.DB) {
		try {
			const auth = createAuth(event.platform.env as AuthEnv, event.url.origin);
			const current = await auth.api.getSession({ headers: event.request.headers });
			event.locals.user = current?.user ?? null;
			event.locals.session = current?.session ?? null;
		} catch (error) {
			// A missing deployment secret must not make public pages unavailable.
			// Auth endpoints still surface the configuration error to operators.
			console.error('Unable to load the authenticated session', error);
		}
	}

	return resolve(event);
};
