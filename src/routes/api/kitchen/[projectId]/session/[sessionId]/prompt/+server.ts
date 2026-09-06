import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSandboxProvider } from '$lib/server/opencode/sandbox';
import { listModels, sendPrompt, type ModelRef, type PromptFile } from '$lib/server/opencode/client';
import { requireActiveAppSession } from '$lib/server/authz';
import { supportsAttachment } from '$lib/attachments';
import { resolveSandboxStartOptions } from '$lib/server/sandbox-context';

export const POST: RequestHandler = async (event) => {
	const { db, app } = await requireActiveAppSession(event);
	const options = await resolveSandboxStartOptions(db, app, event.platform);
	const sandbox = await getSandboxProvider().getOrCreateSandbox(app.id, options);
	const { text, files, model } = (await event.request.json()) as {
		text: string;
		files?: PromptFile[];
		model?: ModelRef;
	};
	if (!text?.trim() && !files?.length) {
		return json({ error: 'text or files required' }, { status: 400 });
	}
	// Re-derive capabilities from opencode itself rather than trusting whatever
	// the client claims about the model it thinks it's talking to — the client
	// only sends the model id/providerID selector, not its capability booleans.
	if (files?.length && model) {
		const models = await listModels(sandbox);
		const resolved = models.find((m) => m.id === model.id && m.providerID === model.providerID);
		const unsupported = files.find((f) => !supportsAttachment(f.mime, resolved?.capabilities));
		if (unsupported) {
			return json(
				{ error: `"${resolved?.name ?? model.id}" doesn't support attaching ${unsupported.mime} files` },
				{ status: 400 }
			);
		}
	}
	const result = await sendPrompt(sandbox, event.params.sessionId, text, files);
	return json(result);
};
