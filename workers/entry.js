// @ts-nocheck -- imports the SvelteKit build output, which only exists after `npm run build`.
// Custom worker entry point. adapter-cloudflare's generated `_worker.js`
// only exports a `fetch` handler -- it has no way to also export a Durable
// Object class. We need both (SvelteKit for the app, Sandbox for the
// counter-app build/deploy/destroy flow), so wrangler's `main` points here
// instead of straight at the generated file, and we re-export both from it.
export { Sandbox } from '@cloudflare/sandbox';
import sveltekitWorker from '../.svelte-kit/cloudflare/_worker.js';

export default sveltekitWorker;
