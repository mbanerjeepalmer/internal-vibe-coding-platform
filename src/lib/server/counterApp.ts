import { getSandbox } from '@cloudflare/sandbox';

// Stand-in for the real Daytona sandbox from docs/02_real_spec.md while the
// Daytona API key is pending approval: a real Cloudflare Sandbox container
// does the "agent's" build work (write files, run `wrangler deploy`), and a
// real Cloudflare Worker is what ends up live. Nothing here is mocked --
// only the sandbox provider differs from the eventual Daytona one.

const SANDBOX_ID = 'ivcp-counter-sandbox';
const WORKDIR = '/workspace/counter-app';
const WORKER_NAME = 'ivcp-counter-demo';
const WRANGLER_VERSION = '4.127.1';

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

async function ensureFiles(sandbox: ReturnType<typeof getSandbox>) {
	await sandbox.mkdir(WORKDIR, { recursive: true });
	await sandbox.writeFile(`${WORKDIR}/index.js`, INDEX_JS);
	await sandbox.writeFile(`${WORKDIR}/wrangler.jsonc`, WRANGLER_JSONC);
}

function cfCreds(env: Env) {
	return {
		CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN,
		CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID
	};
}

export async function deployCounterApp(env: Env): Promise<RunResult & { url?: string }> {
	const sandbox = getSandbox(env.Sandbox, SANDBOX_ID);
	await ensureFiles(sandbox);
	const result = await sandbox.exec(`npx --yes wrangler@${WRANGLER_VERSION} deploy`, {
		cwd: WORKDIR,
		env: cfCreds(env)
	});
	const log = result.stdout + result.stderr;
	const url = log.match(/https:\/\/\S+\.workers\.dev/)?.[0];
	return { success: result.success, log, url };
}

export async function destroyCounterApp(env: Env): Promise<RunResult> {
	const sandbox = getSandbox(env.Sandbox, SANDBOX_ID);
	await ensureFiles(sandbox);
	const result = await sandbox.exec(`npx --yes wrangler@${WRANGLER_VERSION} delete --force`, {
		cwd: WORKDIR,
		env: cfCreds(env)
	});
	return { success: result.success, log: result.stdout + result.stderr };
}
