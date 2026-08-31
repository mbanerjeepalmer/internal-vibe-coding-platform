import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAppAccess } from '$lib/server/authz';
import { deleteSecret, listAppSecrets, saveSecret, type SecretScope } from '$lib/server/secrets';

export const GET: RequestHandler = async (event) => {
	const { db, user, app } = await requireAppAccess(event);
	return json(await listAppSecrets(db, user.id, app.id));
};

export const POST: RequestHandler = async (event) => {
	const { db, user, app } = await requireAppAccess(event);
	const body = await event.request.json() as { scope?: SecretScope; name?: string; value?: string; agentVisible?: boolean };
	if (body.scope !== 'app' && body.scope !== 'kitchen') return json({ message: 'Invalid secret scope.' }, { status: 400 });
	await saveSecret(
		db,
		user.id,
		app.id,
		body.scope,
		String(body.name ?? '').trim(),
		String(body.value ?? ''),
		event.platform?.env.SECRET_ENCRYPTION_KEY,
		body.agentVisible ?? true
	);
	return json({ ok: true });
};

export const DELETE: RequestHandler = async (event) => {
	const { db, user, app } = await requireAppAccess(event);
	const body = await event.request.json() as { scope?: SecretScope; name?: string };
	if (body.scope !== 'app' && body.scope !== 'kitchen') return json({ message: 'Invalid secret scope.' }, { status: 400 });
	await deleteSecret(db, user.id, app.id, body.scope, String(body.name ?? '').trim());
	return json({ ok: true });
};
