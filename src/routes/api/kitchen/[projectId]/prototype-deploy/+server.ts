import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAppAccess } from '$lib/server/authz';
import { prototypeDeploymentAccess, uploadPrototypeWorker, validateWorkerArtifact } from '$lib/server/trusted-worker-upload';

/**
 * Experimental, prebuilt-module deployment. This endpoint does not build source
 * or read the sandbox, and never runs project code with Cloudflare credentials.
 * It deliberately targets a different Worker than the normal deployment.
 */
export const POST: RequestHandler = async (event) => {
	const { app } = await requireAppAccess(event);
	const platform = event.platform;
	const access = prototypeDeploymentAccess(app.role, platform?.env.PROTOTYPE_DEPLOY_ENABLED);
	if (access === 403) throw error(403, 'Only a Head Chef can upload prototype Workers.');
	if (access === 503) {
		return json({ success: false, message: 'Prototype deployment is disabled.' }, { status: 503 });
	}
	const contentLength = Number(event.request.headers.get('content-length') ?? 0);
	if (!Number.isFinite(contentLength) || contentLength > 1_100_000) {
		return json({ success: false, message: 'Artifact is too large.' }, { status: 413 });
	}
	let input: unknown;
	try {
		// Do not trust Content-Length: cap chunked requests as they are read.
		const reader = event.request.body?.getReader();
		if (!reader) throw new Error('Missing body');
		const chunks: Uint8Array[] = [];
		let size = 0;
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > 1_100_000) {
				await reader.cancel();
				return json({ success: false, message: 'Artifact is too large.' }, { status: 413 });
			}
			chunks.push(value);
		}
		const bytes = new Uint8Array(size);
		let offset = 0;
		for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
		input = JSON.parse(new TextDecoder().decode(bytes));
	} catch {
		return json({ success: false, message: 'Send a JSON object containing moduleSource.' }, { status: 400 });
	}
	let artifact;
	try {
		if (input && typeof input === 'object' && 'moduleSource' in input && typeof input.moduleSource === 'string') {
			artifact = validateWorkerArtifact({ entrypoint: 'worker.js', modules: { 'worker.js': input.moduleSource } });
		} else {
			artifact = validateWorkerArtifact(input);
		}
	} catch {
		return json({ success: false, message: 'Invalid code-only Worker artifact.' }, { status: 400 });
	}
	// Only dedicated prototype credentials are allowed. Never fall back to
	// shared Kitchen or platform deployment credentials.
	const accountId = platform?.env.PROTOTYPE_CLOUDFLARE_ACCOUNT_ID;
	const apiToken = platform?.env.PROTOTYPE_CLOUDFLARE_API_TOKEN;
	if (!accountId || !apiToken) {
		return json({ success: false, message: 'Cloudflare deployment credentials are not configured.' }, { status: 503 });
	}
	try {
		await uploadPrototypeWorker(app.id, artifact, { accountId, apiToken });
		return json({ success: true, workerName: `vibe-prototype-${app.id.toLowerCase()}`, message: 'Prototype Worker uploaded. Bindings, static assets, migrations and a public URL are not configured by this endpoint.' });
	} catch {
		// Never surface provider messages or credential material to the browser.
		return json({ success: false, message: 'Prototype upload failed. Check the module and Cloudflare deployment configuration.' }, { status: 502 });
	}
};
