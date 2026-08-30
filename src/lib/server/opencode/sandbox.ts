// Sandbox provisioning for an opencode server process.
//
// Two `SandboxProvider` implementations behind the same interface:
// `DaytonaSandboxProvider` (real Daytona sandboxes, used whenever
// `DAYTONA_API_KEY` is set) and `LocalProcessSandboxProvider` (a local
// `opencode serve` child process, used otherwise — for developing on a
// machine with no Daytona credentials). Nothing above this module cares
// which one is in play.

import { env } from '$env/dynamic/private';
import type { Sandbox as DaytonaSandboxHandle } from '@daytona/sdk';

export interface Sandbox {
	projectId: string;
	/** Base URL of the opencode server reachable from this app server. */
	baseUrl: string;
	/** Extra headers every request to `baseUrl` must carry (e.g. Daytona's preview-link token). */
	headers?: Record<string, string>;
}

/** A URL (+ any headers needed to reach it) for an arbitrary port inside a sandbox — e.g. a dev server the agent started. */
export interface PreviewTarget {
	url: string;
	headers?: Record<string, string>;
}

export interface DeployResult {
	success: boolean;
	log: string;
	url?: string;
}

export interface CloudflareCredentials extends Record<string, string> {
	CLOUDFLARE_API_TOKEN: string;
	CLOUDFLARE_ACCOUNT_ID: string;
}

export interface SandboxProvider {
	getOrCreateSandbox(projectId: string): Promise<Sandbox>;
	/** Resolves an arbitrary port inside a project's sandbox to a reachable URL. Sandbox must already exist. */
	getPreviewUrl(projectId: string, port: number): Promise<PreviewTarget>;
	/** Tears the project's sandbox down entirely (the "hard delete this app" flow in docs/01_hardcoded_demo.md). */
	destroySandbox(projectId: string): Promise<void>;
	/** Runs `wrangler deploy` against whatever the agent has written in the project's working directory. */
	deployProject(projectId: string, creds: CloudflareCredentials): Promise<DeployResult>;
	/**
	 * Runs `wrangler delete` in the project's working directory, tearing down
	 * only the worker named in that directory's own `wrangler.jsonc` — since
	 * the name comes from a file the caller never gets to specify, this can
	 * never be pointed at an arbitrary worker outside the project.
	 */
	undeployProject(projectId: string, creds: CloudflareCredentials): Promise<DeployResult>;
}

// The version we traced opencode's v2 API against (docs/03_opencode_backend_spec.md's
// open question on exact payload shapes) — pinned in both providers so a newer release
// can't silently drift the event/REST shapes our reducer depends on.
const OPENCODE_VERSION = '1.18.25';
const OPENCODE_PORT = 4096;
const WRANGLER_VERSION = '4.127.1';

/**
 * A minimal Workers project seeded into the agent's working directory before
 * opencode starts, so there's always something deployable — the agent edits
 * this rather than starting from an empty directory, and "Deploy" always has
 * a `wrangler.jsonc` to run against even before the agent touches anything.
 */
function starterFiles(projectId: string): Record<string, string> {
	const workerName = `vibe-${projectId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
	return {
		'wrangler.jsonc': JSON.stringify(
			{ name: workerName, main: 'index.js', compatibility_date: '2026-08-30' },
			null,
			2
		),
		'index.js': `export default {\n\tasync fetch(request) {\n\t\treturn new Response('Hello from ${workerName}! Ask the agent to build something.');\n\t}\n};\n`
	};
}

class LocalProcessSandboxProvider implements SandboxProvider {
	private sandboxes = new Map<string, Promise<Sandbox>>();
	private children = new Map<string, import('node:child_process').ChildProcess>();
	private cwds = new Map<string, string>();

	getOrCreateSandbox(projectId: string): Promise<Sandbox> {
		let existing = this.sandboxes.get(projectId);
		if (!existing) {
			existing = this.spawn(projectId);
			this.sandboxes.set(projectId, existing);
			existing.catch(() => this.sandboxes.delete(projectId));
		}
		return existing;
	}

	async getPreviewUrl(_projectId: string, port: number): Promise<PreviewTarget> {
		// The local sandbox is just a subprocess on this machine, so any dev
		// server the agent starts is already reachable directly — no tunnel needed.
		return { url: `http://127.0.0.1:${port}` };
	}

	async destroySandbox(projectId: string): Promise<void> {
		this.children.get(projectId)?.kill();
		this.children.delete(projectId);
		this.sandboxes.delete(projectId);
		this.cwds.delete(projectId);
	}

	async deployProject(projectId: string, creds: CloudflareCredentials): Promise<DeployResult> {
		return this.runWrangler(projectId, creds, ['deploy']);
	}

	async undeployProject(projectId: string, creds: CloudflareCredentials): Promise<DeployResult> {
		return this.runWrangler(projectId, creds, ['delete', '--force']);
	}

	private async runWrangler(
		projectId: string,
		creds: CloudflareCredentials,
		args: string[]
	): Promise<DeployResult> {
		await this.getOrCreateSandbox(projectId);
		const cwd = this.cwds.get(projectId);
		if (!cwd) throw new Error(`no local sandbox provisioned for project ${projectId}`);

		const { execFile } = await import('node:child_process');
		const { promisify } = await import('node:util');
		const run = promisify(execFile);

		try {
			const { stdout, stderr } = await run(
				'npx',
				['--yes', `wrangler@${WRANGLER_VERSION}`, ...args],
				{ cwd, env: { ...process.env, ...creds }, timeout: 120_000 }
			);
			const log = `${stdout}\n${stderr}`;
			return { success: true, log, url: log.match(/https:\/\/\S+\.workers\.dev/)?.[0] };
		} catch (err) {
			const log =
				err && typeof err === 'object' && 'stdout' in err
					? `${(err as { stdout?: string }).stdout ?? ''}\n${(err as { stderr?: string }).stderr ?? ''}`
					: String(err);
			return { success: false, log };
		}
	}

	private async spawn(projectId: string): Promise<Sandbox> {
		const { spawn } = await import('node:child_process');
		const fs = await import('node:fs/promises');
		const os = await import('node:os');
		const path = await import('node:path');

		const cwd = path.join(os.tmpdir(), 'vibe-kitchen-sandboxes', projectId);
		await fs.mkdir(cwd, { recursive: true });
		this.cwds.set(projectId, cwd);

		for (const [name, contents] of Object.entries(starterFiles(projectId))) {
			const filePath = path.join(cwd, name);
			await fs.access(filePath).catch(() => fs.writeFile(filePath, contents));
		}

		const baseUrl = await new Promise<string>((resolve, reject) => {
			const child = spawn('opencode', ['serve', '--port', '0', '--hostname', '127.0.0.1'], {
				cwd,
				stdio: ['ignore', 'pipe', 'pipe'],
				env: { ...process.env }
			});
			this.children.set(projectId, child);

			let settled = false;
			const timeout = setTimeout(() => {
				if (!settled) {
					settled = true;
					child.kill();
					reject(new Error('opencode serve did not report a listening address in time'));
				}
			}, 15_000);

			const onData = (chunk: Buffer) => {
				const text = chunk.toString('utf8');
				const match = text.match(/listening on (http:\/\/\S+)/);
				if (match && !settled) {
					settled = true;
					clearTimeout(timeout);
					resolve(match[1]);
				}
			};
			child.stdout?.on('data', onData);
			child.stderr?.on('data', onData);

			child.on('error', (err) => {
				if (!settled) {
					settled = true;
					clearTimeout(timeout);
					reject(err);
				}
			});
			child.on('exit', (code) => {
				this.sandboxes.delete(projectId);
				this.children.delete(projectId);
				if (!settled) {
					settled = true;
					clearTimeout(timeout);
					reject(new Error(`opencode serve exited early (code ${code})`));
				}
			});

			process.once('exit', () => child.kill());
		});

		return { projectId, baseUrl };
	}
}

/**
 * Real Daytona sandboxes. One sandbox per project, tagged with a
 * `vibe-project` label so it survives our app server restarting (we look it
 * up by label before creating a new one). Traced live against the Daytona
 * SDK + a real sandbox rather than assumed:
 *   - Daytona's default snapshot ships an old, incompatible opencode
 *     (1.1.35 — pre `/api/*` v2 routes) at a *root-owned* global npm
 *     location, so neither using it nor `opencode upgrade`-ing it in place
 *     works (EACCES). We install our own pinned copy into the sandbox
 *     user's home directory instead, which is writable.
 *   - `sandbox.getPreviewLink(port)` returns an HTTPS tunnel URL plus a
 *     token; the token must be sent as the `x-daytona-preview-token`
 *     header (a `?daytona-preview-token=` query param, which seemed like
 *     the more likely shape, returns 401 — confirmed against a live
 *     sandbox, not guessed).
 */
// Fixed working directory the agent writes into inside every project's
// sandbox — opencode is started with this as its cwd, and `deployProject`
// runs `wrangler deploy` from the same place, so the two always agree on
// where "the project" lives without needing to ask opencode.
const PROJECT_DIR = '~/project';

class DaytonaSandboxProvider implements SandboxProvider {
	private sandboxes = new Map<string, Promise<Sandbox>>();
	// The raw Daytona SDK sandbox object per project, kept alongside `sandboxes`
	// so `getPreviewUrl`/`destroySandbox` don't need to re-look-it-up by label.
	private raw = new Map<string, DaytonaSandboxHandle>();
	private daytonaPromise: ReturnType<typeof this.makeClient> | undefined;

	constructor(private apiKey: string) {}

	private async makeClient() {
		patchFetchForWorkersCacheBug();
		const { Daytona } = await import('@daytona/sdk');
		return new Daytona({ apiKey: this.apiKey });
	}

	private client() {
		if (!this.daytonaPromise) this.daytonaPromise = this.makeClient();
		return this.daytonaPromise;
	}

	getOrCreateSandbox(projectId: string): Promise<Sandbox> {
		let existing = this.sandboxes.get(projectId);
		if (!existing) {
			existing = this.provision(projectId);
			this.sandboxes.set(projectId, existing);
			existing.catch(() => this.sandboxes.delete(projectId));
		}
		return existing;
	}

	async getPreviewUrl(projectId: string, port: number): Promise<PreviewTarget> {
		await this.getOrCreateSandbox(projectId);
		const daytonaSandbox = this.raw.get(projectId);
		if (!daytonaSandbox) throw new Error(`no Daytona sandbox provisioned for project ${projectId}`);
		const preview = await daytonaSandbox.getPreviewLink(port);
		return { url: preview.url, headers: { 'x-daytona-preview-token': preview.token } };
	}

	async destroySandbox(projectId: string): Promise<void> {
		const daytona = await this.client();
		const label = { 'vibe-project': projectId };
		for await (const candidate of daytona.list({ labels: label })) {
			await daytona.delete(candidate, 60, true);
		}
		this.sandboxes.delete(projectId);
		this.raw.delete(projectId);
	}

	private async provision(projectId: string): Promise<Sandbox> {
		const daytona = await this.client();
		const label = { 'vibe-project': projectId };

		let daytonaSandbox: DaytonaSandboxHandle | undefined;
		for await (const candidate of daytona.list({ labels: label })) {
			daytonaSandbox = candidate;
			break;
		}
		if (!daytonaSandbox) {
			daytonaSandbox = await daytona.create({ labels: label }, { timeout: 90 });
		} else if (daytonaSandbox.state !== 'started') {
			await daytona.start(daytonaSandbox, 60);
		}
		this.raw.set(projectId, daytonaSandbox);

		await this.ensureOpencodeInstalled(daytonaSandbox);
		await this.ensureProjectScaffold(daytonaSandbox, projectId);

		const preview = await daytonaSandbox.getPreviewLink(OPENCODE_PORT);
		const headers = { 'x-daytona-preview-token': preview.token };
		await this.ensureServerRunning(daytonaSandbox, preview.url, headers);

		return { projectId, baseUrl: preview.url, headers };
	}

	async deployProject(projectId: string, creds: CloudflareCredentials): Promise<DeployResult> {
		return this.runWrangler(projectId, creds, 'deploy');
	}

	async undeployProject(projectId: string, creds: CloudflareCredentials): Promise<DeployResult> {
		return this.runWrangler(projectId, creds, 'delete --force');
	}

	private async runWrangler(
		projectId: string,
		creds: CloudflareCredentials,
		args: string
	): Promise<DeployResult> {
		await this.getOrCreateSandbox(projectId);
		const daytonaSandbox = this.raw.get(projectId);
		if (!daytonaSandbox) throw new Error(`no Daytona sandbox provisioned for project ${projectId}`);

		const result = await daytonaSandbox.process.executeCommand(
			`cd ${PROJECT_DIR} && npx --yes wrangler@${WRANGLER_VERSION} ${args}`,
			undefined,
			creds,
			120
		);
		const log = result.result ?? '';
		return {
			success: result.exitCode === 0,
			log,
			url: log.match(/https:\/\/\S+\.workers\.dev/)?.[0]
		};
	}

	private async ensureProjectScaffold(daytonaSandbox: { process: DaytonaProcess }, projectId: string) {
		const check = await daytonaSandbox.process.executeCommand(
			`test -f ${PROJECT_DIR}/wrangler.jsonc && echo present`
		);
		if (check.result?.includes('present')) return;

		const files = starterFiles(projectId);
		const writes = Object.entries(files)
			.map(([name, contents]) => `printf '%s' '${contents.replace(/'/g, `'\\''`)}' > ${PROJECT_DIR}/${name}`)
			.join(' && ');
		const result = await daytonaSandbox.process.executeCommand(`mkdir -p ${PROJECT_DIR} && ${writes}`);
		if (result.exitCode !== 0) {
			throw new Error(`seeding the starter project into the Daytona sandbox failed:\n${result.result}`);
		}
	}

	private async ensureOpencodeInstalled(daytonaSandbox: { process: DaytonaProcess }) {
		const check = await daytonaSandbox.process.executeCommand(
			'test -x ~/opencode-runtime/node_modules/.bin/opencode && echo present'
		);
		if (check.result?.includes('present')) return;

		const install = await daytonaSandbox.process.executeCommand(
			`mkdir -p ~/opencode-runtime && cd ~/opencode-runtime && npm init -y >/dev/null 2>&1 && npm install opencode-ai@${OPENCODE_VERSION} 2>&1`,
			undefined,
			undefined,
			120
		);
		if (install.exitCode !== 0) {
			throw new Error(`installing opencode in the Daytona sandbox failed:\n${install.result}`);
		}
	}

	private async ensureServerRunning(
		daytonaSandbox: { process: DaytonaProcess },
		baseUrl: string,
		headers: Record<string, string>
	) {
		if (await this.isHealthy(baseUrl, headers)) return;

		const sessionId = 'opencode-serve';
		try {
			await daytonaSandbox.process.createSession(sessionId);
		} catch {
			// Session already exists from a prior provision of this same sandbox — fine.
		}
		await daytonaSandbox.process.executeSessionCommand(sessionId, {
			command: `cd ${PROJECT_DIR} && ~/opencode-runtime/node_modules/.bin/opencode serve --port ${OPENCODE_PORT} --hostname 0.0.0.0 > /tmp/opencode.log 2>&1`,
			runAsync: true
		});

		// The first `getPreviewLink` call for a port also provisions Daytona's
		// proxy/tunnel for it, which (like the sandbox's own cold boot + npm
		// install) can take well over the ~20s a warm process would need —
		// observed a ~5min first-provision wall-clock time against a real
		// account. Poll generously; this only ever runs once per sandbox.
		const deadline = Date.now() + 180_000;
		while (Date.now() < deadline) {
			if (await this.isHealthy(baseUrl, headers)) return;
			await new Promise((r) => setTimeout(r, 1_000));
		}
		throw new Error('opencode serve did not become healthy inside the Daytona sandbox in time');
	}

	private async isHealthy(baseUrl: string, headers: Record<string, string>) {
		try {
			const res = await fetch(`${baseUrl}/api/health`, { headers });
			return res.ok;
		} catch {
			return false;
		}
	}
}

// Structural type so the private helper methods above don't need to import
// the SDK's full Process class just to be typed.
interface DaytonaProcess {
	executeCommand(
		command: string,
		cwd?: string,
		env?: Record<string, string>,
		timeout?: number
	): Promise<{ exitCode?: number | null; result?: string }>;
	createSession(sessionId: string): Promise<void>;
	executeSessionCommand(
		sessionId: string,
		req: { command: string; runAsync?: boolean }
	): Promise<unknown>;
}

let fetchPatched = false;

/**
 * `@daytona/sdk` talks to Daytona's API through axios, whose fetch adapter
 * hardcodes `cache: 'default'` — but it does so by baking it into a `Request`
 * object it constructs itself (`new Request(url, { cache: 'default', ... })`)
 * and then calling `fetch(thatRequest)`, so patching `fetch`'s second
 * argument does nothing; the Request object already carries the field.
 * Cloudflare Workers' fetch rejects any Request built with an explicit
 * `cache` value ("Unsupported cache mode: default") — confirmed live by
 * deploying this to a real Worker, not assumed. Strip it at the `Request`
 * constructor instead. Harmless on Node; needed on Workers.
 */
function patchFetchForWorkersCacheBug() {
	if (fetchPatched) return;
	fetchPatched = true;
	const OriginalRequest = globalThis.Request;
	if (!OriginalRequest) return;
	globalThis.Request = new Proxy(OriginalRequest, {
		construct(target, args: [RequestInfo | URL, RequestInit?]) {
			const [input, init] = args;
			if (init && typeof init === 'object' && 'cache' in init) {
				const { cache: _cache, ...rest } = init;
				return new target(input, rest);
			}
			return new target(input, init);
		}
	});
}

let provider: SandboxProvider | undefined;

export function getSandboxProvider(): SandboxProvider {
	if (!provider) {
		provider = env.DAYTONA_API_KEY
			? new DaytonaSandboxProvider(env.DAYTONA_API_KEY)
			: new LocalProcessSandboxProvider();
	}
	return provider;
}
