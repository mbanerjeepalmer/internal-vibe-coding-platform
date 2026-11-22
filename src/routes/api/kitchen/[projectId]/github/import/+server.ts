import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAppAccess } from '$lib/server/authz';
import { effectiveKitchenSecrets } from '$lib/server/secrets';
import { getSandboxProvider } from '$lib/server/opencode/sandbox';
import { resolveSandboxStartOptions } from '$lib/server/sandbox-context';
import { saveAppSource } from '$lib/server/app-source';
import { markSourceSaved } from '$lib/server/control-plane';

const MAX_ARCHIVE = 20 * 1024 * 1024;

async function boundedBytes(response: Response) {
	if (!response.body) throw error(502, 'GitHub returned an empty archive.');
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > MAX_ARCHIVE) { await reader.cancel(); throw error(413, 'Repository archive exceeds 20 MB.'); }
			chunks.push(value);
		}
	} finally { reader.releaseLock(); }
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
	return bytes;
}

// Content-only import, intentionally not a Git connection. The archive is
// read by the control plane so a GitHub credential never enters the sandbox.
export const POST: RequestHandler = async (event) => {
	const { db, app } = await requireAppAccess(event);
	if (app.role !== 'head_chef') throw error(403, 'Only a Head Chef can import from GitHub.');
	const bucket = event.platform?.env.APP_SOURCE;
	if (!bucket) throw error(503, 'Source persistence is required before importing.');
	const body = await event.request.json() as { repository?: unknown; branch?: unknown };
	const repository = typeof body.repository === 'string' ? body.repository : '';
	const branch = typeof body.branch === 'string' ? body.branch : '';
	if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9_.-]{1,100}$/.test(repository)) throw error(400, 'Invalid repository.');
	if (!branch || branch.length > 200 || /[\x00-\x1f\x7f]/.test(branch)) throw error(400, 'Invalid branch.');
	const tokenRow = await db.prepare("SELECT agent_visible AS agentVisible FROM secrets WHERE kitchen_id = ? AND name = 'GITHUB_TOKEN'")
		.bind(app.kitchenId).first<{ agentVisible: number }>();
	if (!tokenRow || tokenRow.agentVisible) throw error(400, 'Set a Kitchen GITHUB_TOKEN with agent access turned off.');
	const token = (await effectiveKitchenSecrets(db, app.kitchenId, event.platform?.env.SECRET_ENCRYPTION_KEY)).GITHUB_TOKEN;
	if (!token || /[\r\n]/.test(token)) throw error(503, 'The GitHub token is invalid.');
	const [owner, name] = repository.split('/');
	const apiBase = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
	const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'vibe-kitchen', 'X-GitHub-Api-Version': '2022-11-28' };
	const commitResponse = await fetch(`${apiBase}/commits/${encodeURIComponent(branch)}`, { headers, redirect: 'error' });
	if (!commitResponse.ok) throw error(502, `GitHub could not resolve the branch (${commitResponse.status}).`);
	const commit = await commitResponse.json() as { sha?: unknown };
	if (typeof commit.sha !== 'string' || !/^[a-f0-9]{40}$/.test(commit.sha)) throw error(502, 'GitHub returned an invalid commit.');
	// The API redirects archives to codeload. Never forward the token to the
	// redirect target, or let an arbitrary redirect select a host.
	const archiveResponse = await fetch(`${apiBase}/tarball/${commit.sha}`, { headers, redirect: 'manual' });
	const location = archiveResponse.headers.get('location');
	if (![301, 302, 303, 307, 308].includes(archiveResponse.status) || !location) throw error(502, 'GitHub did not provide an archive location.');
	let url: URL;
	try { url = new URL(location); } catch { throw error(502, 'Invalid archive location.'); }
	if (url.protocol !== 'https:' || url.hostname !== 'codeload.github.com' || url.port || url.username || url.password) throw error(502, 'Unexpected archive host.');
	// The redirect can be a short-lived bearer URL. Never expose it, including
	// in an exception or log, and never forward the original GitHub token.
	let download: Response;
	try { download = await fetch(url, { redirect: 'error', headers: { 'User-Agent': 'vibe-kitchen' } }); }
	catch { throw error(502, 'GitHub archive download failed. Please try again.'); }
	if (!download.ok) throw error(502, `GitHub archive download failed (${download.status}).`);
	const bytes = await boundedBytes(download);
	const provider = getSandboxProvider();
	const options = await resolveSandboxStartOptions(db, app, event.platform);
	await provider.getOrCreateSandbox(app.id, options);
	const id = crypto.randomUUID();
	const archive = `.vibe-import-${id}.tar.gz`;
	const directory = `github-import-${id}`;
	await provider.writeFile(app.id, archive, bytes, options);
	// Validate every archive entry before writing any content. Do not follow
	// links, extract device files, use absolute paths or accept .. segments.
	const script = `import os,sys,tarfile,shutil\na=sys.argv[1]; d=sys.argv[2]; created=False\ntry:\n with tarfile.open(a,'r:gz') as t:\n  members=t.getmembers()\n  if len(members)>10000 or sum(m.size for m in members)>100*1024*1024: raise ValueError('archive too large')\n  checked=[]\n  root=None\n  for m in members:\n   parts=m.name.split('/')\n   if not parts[0] or m.name.startswith('/') or any(x in ('.','..') for x in parts): raise ValueError('unsafe path')\n   if root is None: root=parts[0]\n   if parts[0]!=root or not (m.isfile() or m.isdir()): raise ValueError('unsupported archive entry')\n   rel='/'.join(x for x in parts[1:] if x)\n   if rel: checked.append((m,rel))\n  os.mkdir(d)\n  created=True\n  for m,rel in checked:\n   target=os.path.join(d,rel)\n   if m.isdir(): os.makedirs(target,exist_ok=True)\n   else:\n    os.makedirs(os.path.dirname(target),exist_ok=True)\n    with t.extractfile(m) as source,open(target,'xb') as out: shutil.copyfileobj(source,out)\nexcept Exception:\n if created: shutil.rmtree(d)\n raise\nfinally:\n try: os.remove(a)\n except FileNotFoundError: pass\n`;
	const encoded = btoa(script);
	const result = await provider.executeProjectCommand(app.id, `python3 -c "import base64;exec(base64.b64decode('${encoded}'))" '${archive}' '${directory}'; status=$?; rm -f '${archive}'; exit $status`);
	if (result.exitCode !== 0) throw error(422, 'Import failed: the archive was unsafe, too large, or the sandbox has no Python 3.');
	try { await saveAppSource(bucket, app.id, provider); await markSourceSaved(db, app.id); }
	catch { return json({ imported: true, saved: false, directory, commit: commit.sha, message: 'Imported files are in the sandbox, but the source snapshot failed. Save the app before closing the sandbox.' }, { status: 202 }); }
	return json({ imported: true, saved: true, directory, commit: commit.sha });
};
