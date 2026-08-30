import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { setKitchenDefaultModel } from '$lib/server/control-plane';
import { requireAppAccess } from '$lib/server/authz';
import type { ModelRef } from '$lib/server/opencode/client';

// Scoped by app id like every other /api/kitchen/[projectId] route, but the
// change applies Kitchen-wide — every app in the Kitchen picks up the new
// default the next time it starts a session.
export const POST: RequestHandler = async (event) => {
	const { db, user, app } = await requireAppAccess(event);
	if (app.role !== 'head_chef') throw error(403, 'Only the Head Chef can change this Kitchen\'s default model.');
	const { model } = (await event.request.json()) as { model: ModelRef | null };
	await setKitchenDefaultModel(db, user.id, app.kitchenId, model);
	return json({ ok: true });
};
