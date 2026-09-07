import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAppAccess } from '$lib/server/authz';
import { getSandboxProvider, safeRelativePath } from '$lib/server/opencode/sandbox';
import { resolveSandboxStartOptions } from '$lib/server/sandbox-context';

// Any Chef in the Kitchen (not just the Head Chef) can browse and upload —
// `requireAppAccess` only checks App membership, matching the other
// any-member routes (e.g. secrets' GET).

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_FILES_PER_UPLOAD = 20;

function parsePath(raw: string | null | undefined) {
	try {
		return safeRelativePath(raw ?? '');
	} catch {
		throw error(400, 'Invalid path.');
	}
}

// This can be the first route to touch a brand-new App's sandbox (a chef
// opening the Files tab before ever sending a prompt), so it must resolve
// the same SandboxStartOptions as /models, /session and /prompt — otherwise
// a previously saved source snapshot could silently never get restored.
export const GET: RequestHandler = async (event) => {
	const { db, app } = await requireAppAccess(event);
	const path = parsePath(event.url.searchParams.get('path'));
	const options = await resolveSandboxStartOptions(db, app, event.platform);
	const entries = await getSandboxProvider().listFiles(app.id, path, options);
	return json({ path, entries });
};

export const POST: RequestHandler = async (event) => {
	const { db, app } = await requireAppAccess(event);
	const formData = await event.request.formData();
	const dir = parsePath(typeof formData.get('path') === 'string' ? (formData.get('path') as string) : '');

	const files = formData.getAll('file').filter((entry): entry is File => entry instanceof File);
	if (files.length === 0) throw error(400, 'No files were provided.');
	if (files.length > MAX_FILES_PER_UPLOAD) {
		throw error(400, `Upload at most ${MAX_FILES_PER_UPLOAD} files at a time.`);
	}

	const sandboxProvider = getSandboxProvider();
	const options = await resolveSandboxStartOptions(db, app, event.platform);
	const written: string[] = [];
	for (const file of files) {
		if (file.size > MAX_FILE_BYTES) {
			throw error(413, `"${file.name}" is larger than ${MAX_FILE_BYTES / (1024 * 1024)}MB.`);
		}
		if (!file.name || file.name.includes('/') || file.name.includes('\\')) {
			throw error(400, `"${file.name}" is not a valid file name.`);
		}
		let destPath: string;
		try {
			destPath = safeRelativePath(dir ? `${dir}/${file.name}` : file.name);
		} catch {
			throw error(400, `"${file.name}" is not a valid file name.`);
		}
		await sandboxProvider.writeFile(app.id, destPath, new Uint8Array(await file.arrayBuffer()), options);
		written.push(destPath);
	}

	return json({ written });
};
