import type { PageServerLoad } from './$types';
import { extractSendingDomain } from '$lib/server/email-branding';

export const load: PageServerLoad = ({ platform }) => {
	return { sendingDomain: extractSendingDomain(platform?.env.RESEND_FROM_EMAIL ?? '') };
};
