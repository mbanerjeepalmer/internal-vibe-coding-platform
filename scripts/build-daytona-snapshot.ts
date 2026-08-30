// Builds (or rebuilds) the Daytona snapshot that `DaytonaSandboxProvider`
// creates every project sandbox from. Baking opencode into the image here
// means `daytona.create` never has to `npm install opencode-ai` cold inside
// a fresh sandbox — see the "why is Daytona slow to start" note in
// src/lib/server/opencode/sandbox.ts.
//
// One snapshot per kitchen deployment (not per project) — run this whenever
// OPENCODE_SNAPSHOT_VERSION below changes, then it's reused by every sandbox
// this deployment creates until the next bump.
//
// Usage: node --env-file=.dev.vars scripts/build-daytona-snapshot.ts

import { Daytona, Image } from '@daytona/sdk';

// Keep in sync with OPENCODE_VERSION in src/lib/server/opencode/sandbox.ts —
// bumping either one means rebuilding the snapshot before it takes effect.
const OPENCODE_VERSION = '1.18.25';
export const SNAPSHOT_NAME = `vibe-kitchen-opencode-${OPENCODE_VERSION}`;

async function main() {
	const apiKey = process.env.DAYTONA_API_KEY;
	if (!apiKey) throw new Error('DAYTONA_API_KEY is not set');

	const daytona = new Daytona({ apiKey });

	const image = Image.base('node:22-slim').runCommands(
		'mkdir -p ~/opencode-runtime && cd ~/opencode-runtime && npm init -y >/dev/null 2>&1 && ' +
			`npm install opencode-ai@${OPENCODE_VERSION}`
	);

	console.log(`Building snapshot "${SNAPSHOT_NAME}"...`);
	await daytona.snapshot.create({ name: SNAPSHOT_NAME, image }, { onLogs: console.log });
	console.log(`Snapshot "${SNAPSHOT_NAME}" ready.`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
