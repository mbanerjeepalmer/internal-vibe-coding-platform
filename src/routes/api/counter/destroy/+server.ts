import { json } from '@sveltejs/kit';
import { destroyCounterApp } from '$lib/server/counterApp';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ platform }) => {
	if (!platform) return json({ success: false, log: 'No platform bindings available.' }, { status: 500 });
	const result = await destroyCounterApp(platform.env);
	return json(result);
};
