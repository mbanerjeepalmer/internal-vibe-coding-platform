import type { Sandbox as DaytonaSandboxHandle } from '@daytona/sdk';

// Real Daytona sandbox per docs/02_real_spec.md: an isolated container does
// the "agent's" build work (write files, run `wrangler deploy`), and a real
// Cloudflare Worker is what ends up live. Nothing here is mocked.
//
// One persistent sandbox (tagged with a label, per the pattern already
// verified live in the opencode-wiring worktree's src/lib/server/opencode/sandbox.ts)
// is reused across deploy/destroy calls rather than provisioned per call.
//
// Two Daytona quirks discovered against a live sandbox, both worked around
// below rather than being Daytona-side bugs we can fix:
//   - Passing a `cwd` to `executeCommand` routes through a toolbox code path
//     that shells out via `/usr/bin/zsh`, which is missing or unusable on
//     the default snapshot ("fork/exec /usr/bin/zsh: no such file or
//     directory" / "permission denied"). Never pass `cwd`; `cd <dir> && ...`
//     inline in the command string instead.
//   - Sandboxes sit behind a domain-allowlisting egress proxy (HTTPS to a
//     non-listed domain gets a mid-handshake connection reset, not a clean
//     block) that by default doesn't include Cloudflare's API. `domainAllowList`
//     replaces rather than extends the default list, so it must include npm's
//     registry too (needed for `npx wrangler` itself) alongside Cloudflare's.

const SANDBOX_LABEL = { 'vibe-app': 'ivcp-counter' };
const WORKDIR = '/home/daytona/counter-app';
const WORKER_NAME = 'ivcp-counter-demo';
const WRANGLER_VERSION = '4.127.1';
const DOMAIN_ALLOW_LIST =
	'api.cloudflare.com,*.cloudflare.com,workers.dev,*.workers.dev,registry.npmjs.org,*.npmjs.org';

const INDEX_JS = `export class Counter {
	constructor(state) {
		this.state = state;
	}

	async fetch(request) {
		let count = (await this.state.storage.get('count')) ?? 0;
		if (request.method === 'POST') {
			count += 1;
			await this.state.storage.put('count', count);
		}
		return Response.json({ count });
	}
}

const PAGE = \`<!doctype html>
<html>
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>Vibe Kitchen counter</title>
	<style>
		body { font-family: system-ui, sans-serif; display: grid; place-items: center; height: 100vh; margin: 0; background: #fafaf9; }
		button { font-size: 1.5rem; padding: 0.75rem 1.5rem; border-radius: 0.5rem; border: 1px solid #d6d3d1; background: white; cursor: pointer; }
		p { font-size: 3rem; margin: 0 0 1rem; }
	</style>
</head>
<body>
	<div style="text-align: center">
		<p id="count">0</p>
		<button id="inc">Increment</button>
	</div>
	<script>
		const countEl = document.getElementById('count');
		async function refresh(method) {
			const res = await fetch('/count', { method });
			const { count } = await res.json();
			countEl.textContent = count;
		}
		document.getElementById('inc').addEventListener('click', () => refresh('POST'));
		refresh('GET');
	</script>
</body>
</html>\`;

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		if (url.pathname === '/count') {
			const id = env.COUNTER.idFromName('global');
			return env.COUNTER.get(id).fetch(request);
		}
		return new Response(PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } });
	}
};
`;

const WRANGLER_JSONC = JSON.stringify(
	{
		name: WORKER_NAME,
		main: 'index.js',
		compatibility_date: '2026-08-30',
		durable_objects: {
			bindings: [{ class_name: 'Counter', name: 'COUNTER' }]
		},
		migrations: [{ tag: 'v1', new_sqlite_classes: ['Counter'] }]
	},
	null,
	2
);

interface RunResult {
	success: boolean;
	log: string;
}

interface DaytonaProcess {
	executeCommand(
		command: string,
		cwd?: string,
		env?: Record<string, string>,
		timeout?: number
	): Promise<{ exitCode?: number | null; result?: string }>;
}

async function getOrCreateSandbox(env: Env): Promise<DaytonaSandboxHandle> {
	const { Daytona } = await import('@daytona/sdk');
	const daytona = new Daytona({ apiKey: env.DAYTONA_API_KEY });

	for await (const candidate of daytona.list({ labels: SANDBOX_LABEL })) {
		if (candidate.state !== 'started') await daytona.start(candidate, 60);
		return candidate;
	}
	return daytona.create(
		{ labels: SANDBOX_LABEL, domainAllowList: DOMAIN_ALLOW_LIST },
		{ timeout: 90 }
	);
}

async function ensureFiles(sandbox: { process: DaytonaProcess }) {
	const escapedIndex = INDEX_JS.replace(/'/g, `'\\''`);
	const escapedWrangler = WRANGLER_JSONC.replace(/'/g, `'\\''`);
	const result = await sandbox.process.executeCommand(
		`mkdir -p ${WORKDIR} && printf '%s' '${escapedIndex}' > ${WORKDIR}/index.js && printf '%s' '${escapedWrangler}' > ${WORKDIR}/wrangler.jsonc`
	);
	if (result.exitCode !== 0) {
		throw new Error(`writing counter app files into the Daytona sandbox failed:\n${result.result}`);
	}
}

function cfCreds(env: Env) {
	return {
		CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN,
		CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID
	};
}

export async function deployCounterApp(env: Env): Promise<RunResult & { url?: string }> {
	const sandbox = await getOrCreateSandbox(env);
	await ensureFiles(sandbox);
	const result = await sandbox.process.executeCommand(
		`cd ${WORKDIR} && npx --yes wrangler@${WRANGLER_VERSION} deploy`,
		undefined,
		cfCreds(env),
		120
	);
	const log = result.result ?? '';
	const url = log.match(/https:\/\/\S+\.workers\.dev/)?.[0];
	return { success: result.exitCode === 0, log, url };
}

export async function destroyCounterApp(env: Env): Promise<RunResult> {
	const sandbox = await getOrCreateSandbox(env);
	await ensureFiles(sandbox);
	const result = await sandbox.process.executeCommand(
		`cd ${WORKDIR} && npx --yes wrangler@${WRANGLER_VERSION} delete --force`,
		undefined,
		cfCreds(env),
		120
	);
	return { success: result.exitCode === 0, log: result.result ?? '' };
}
