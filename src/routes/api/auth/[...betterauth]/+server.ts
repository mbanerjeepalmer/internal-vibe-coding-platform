import type { RequestHandler } from './$types';
import { createAuth, type AuthEnv } from '$lib/server/auth';

const handler: RequestHandler = ({ request, platform, url }) => {
	if (!platform?.env.DB) {
		throw new Error('Cloudflare D1 is required for authentication.');
	}

	return createAuth(platform.env as AuthEnv, url.origin).handler(request);
};

export const GET = handler;
export const POST = handler;
