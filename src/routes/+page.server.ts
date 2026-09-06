import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Signed-in visitors already have a dashboard; only signed-out visitors see
// the explainer below.
export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) redirect(307, '/home');
	return {};
};
