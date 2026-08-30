import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { setKitchenAgentGuidance } from '$lib/server/control-plane';
import { getSandboxProvider } from '$lib/server/opencode/sandbox';
import { requireAppAccess } from '$lib/server/authz';

const MAX_GUIDANCE_LENGTH = 12_000;

export const PUT: RequestHandler = async (event) => {
	const { db, user, app } = await requireAppAccess(event);
	if (app.role !== 'head_chef') throw error(403, 'Only the Head Chef can change this Kitchen\'s agent guidance.');
	const body = (await event.request.json().catch(() => null)) as { guidance?: unknown } | null;
	if (typeof body?.guidance !== 'string') throw error(400, 'Guidance must be text.');
	const guidance = body.guidance.trim();
	if (guidance.length > MAX_GUIDANCE_LENGTH) throw error(400, `Guidance must be ${MAX_GUIDANCE_LENGTH} characters or fewer.`);

	await setKitchenAgentGuidance(db, user.id, app.kitchenId, guidance);
	// Also refresh the skill in the current app's existing sandbox immediately.
	await getSandboxProvider().getOrCreateSandbox(app.id, guidance);
	return json({ guidance });
};
