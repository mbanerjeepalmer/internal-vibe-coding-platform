/** Check the experimental upload gate before reading artifacts or credentials. */
export function prototypeDeploymentAccess(role: string, enabled?: string): 403 | 503 | null {
	if (role !== 'head_chef') return 403;
	if (enabled !== 'true') return 503;
	return null;
}

export type WorkerArtifact = { entrypoint: string; modules: Record<string, string> };

/** Validates a bounded, code-only artifact. Project config is never forwarded. */
export function validateWorkerArtifact(value: unknown): WorkerArtifact {
	if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid artifact.');
	const candidate = value as { entrypoint?: unknown; modules?: unknown };
	if (typeof candidate.entrypoint !== 'string' || !candidate.modules || typeof candidate.modules !== 'object' || Array.isArray(candidate.modules)) throw new Error('Invalid artifact.');
	const entries = Object.entries(candidate.modules);
	if (entries.length === 0 || entries.length > 64) throw new Error('Invalid module count.');
	let totalBytes = 0;
	for (const [name, source] of entries) {
		// Names become multipart fields; do not permit traversal or metadata collisions.
		if (!/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\/[A-Za-z0-9_.-]+\.m?js$|^[A-Za-z0-9_-][A-Za-z0-9_.-]*\.m?js$/.test(name) || name.split('/').some(part => part === '.' || part === '..') || typeof source !== 'string' || !source) throw new Error('Invalid module.');
		totalBytes += new TextEncoder().encode(source).byteLength;
	}
	if (totalBytes > 1_000_000 || !Object.hasOwn(candidate.modules, candidate.entrypoint)) throw new Error('Invalid artifact entrypoint or size.');
	return candidate as WorkerArtifact;
}

/**
 * Prototype only: upload already-built ES modules from the control plane.
 * The caller must authenticate and authorise the app before calling this.
 * No project code, config, dependency or build script runs with credentials.
 *
 * Deliberately not wired to the deployment route: this does not yet handle
 * assets, migrations, app secrets, previews, or existing Workers safely.
 */
export async function uploadPrototypeWorker(
	appId: string,
	artifact: WorkerArtifact | string,
	credentials: { accountId: string; apiToken: string },
	request: typeof fetch = fetch
): Promise<void> {
	// Fixed platform-owned name and separate prototype namespace: callers
	// cannot choose a production worker or override the target via wrangler.
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appId)) {
		throw new Error('Invalid app ID.');
	}
	if (!/^[0-9a-f]{32}$/i.test(credentials.accountId) || !credentials.apiToken) {
		throw new Error('Invalid Cloudflare credentials.');
	}
	const validated = validateWorkerArtifact(typeof artifact === 'string' ? { entrypoint: 'worker.js', modules: { 'worker.js': artifact } } : artifact);
	const form = new FormData();
	form.set('metadata', JSON.stringify({ main_module: validated.entrypoint, compatibility_date: '2026-08-30' }));
	for (const [name, source] of Object.entries(validated.modules)) {
		form.set(name, new Blob([source], { type: 'application/javascript+module' }), name);
	}
	const script = `vibe-prototype-${appId.toLowerCase()}`;
	const response = await request(`https://api.cloudflare.com/client/v4/accounts/${credentials.accountId}/workers/scripts/${script}`, {
		method: 'PUT',
		headers: { Authorization: `Bearer ${credentials.apiToken}` },
		body: form,
		redirect: 'error'
	});
	// Provider error messages can contain user-controlled input. Do not echo
	// them, the API token, or the module into logs or browser responses.
	if (!response.ok) throw new Error(`Cloudflare Worker upload failed (HTTP ${response.status}).`);
	const body = await response.json() as { success?: boolean };
	if (body.success !== true) throw new Error('Cloudflare Worker upload failed.');
}
