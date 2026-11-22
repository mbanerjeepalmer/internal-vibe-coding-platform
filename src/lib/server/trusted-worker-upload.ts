/** Check the experimental upload gate before reading artifacts or credentials. */
export function prototypeDeploymentAccess(role: string, enabled?: string): 403 | 503 | null {
	if (role !== 'head_chef') return 403;
	if (enabled !== 'true') return 503;
	return null;
}

/**
 * Prototype only: upload one already-built ES module from the control plane.
 * The caller must authenticate and authorise the app before calling this.
 * No project code, config, dependency or build script runs with credentials.
 *
 * Deliberately not wired to the deployment route: this does not yet handle
 * assets, migrations, app secrets, previews, or existing Workers safely.
 */
export async function uploadPrototypeWorker(
	appId: string,
	moduleSource: string,
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
	if (!moduleSource || new TextEncoder().encode(moduleSource).byteLength > 1_000_000) {
		throw new Error('Worker module must be between 1 byte and 1 MB.');
	}
	const form = new FormData();
	form.set('metadata', JSON.stringify({ main_module: 'worker.js', compatibility_date: '2026-08-30' }));
	form.set('worker.js', new Blob([moduleSource], { type: 'application/javascript+module' }), 'worker.js');
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
