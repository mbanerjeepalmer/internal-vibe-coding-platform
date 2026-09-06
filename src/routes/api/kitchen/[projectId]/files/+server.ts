import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAppAccess } from '$lib/server/authz';
import { getSandboxProvider, safeRelativePath } from '$lib/server/opencode/sandbox';

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

export const GET: RequestHandler = async (event) => {
	const { app } = await requireAppAccess(event);
	const path = parsePath(event.url.searchParams.get('path'));
	const entries = await getSandboxProvider().listFiles(app.id, path);
	return json({ path, entries });
};

export const POST: RequestHandler = async (event) => {
	const { app } = await requireAppAccess(event);
	const formData = await event.request.formData();
	const dir = parsePath(typeof formData.get('path') === 'string' ? (formData.get('path') as string) : '');

	const files = formData.getAll('file').filter((entry): entry is File => entry instanceof File);
	if (files.length === 0) throw error(400, 'No files were provided.');
	if (files.length > MAX_FILES_PER_UPLOAD) {
		throw error(400, `Upload at most ${MAX_FILES_PER_UPLOAD} files at a time.`);
	}

	const sandboxProvider = getSandboxProvider();
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
		await sandboxProvider.writeFile(app.id, destPath, new Uint8Array(await file.arrayBuffer()));
		written.push(destPath);
	}

	return json({ written });
};
