# Internal Vibe Coding Platform

In the `01_hardcoded_demo.md` we've described a high-level journey for a personal use case. We want to take this to the point where it can be a fully-featured enterprise-grade internal vibe coding platform.

In this document we need to flesh out the full set of requirements and the phasing of their implementation.

## A complete internal vibe coding platform

This means:
- Secrets management:
  - Needs cascade management.
  - Overlaps with observability, since you want to monitor usage of things like API calls.
  - May also need provisioning.
- Specifications:
  - Combination of conversation history and persistent files in the repo.
- Deployment
- Code hosting and version control
- Agent-user interface:
  - We always need an agent. It can be different across cases, but it should be something like Codex, Claude, OpenCode or Pi.
  - Users need to be able to control the agent.
- Environment:
  - We prefer Daytona for this demo.
  - But ultimately it should be possible to configure any environment (e.g. VPS, Docker, local).
- Tools/utilities:
  - We should be able to configure the project so that it comes preloaded with skills/`AGENT.md` (and we want to be able to hook them in at the right points).
- Persistent storage:
  - Members (Chefs) should be able to set up databases and blob storage.
- Observability and analytics:
  - Kitchen owners (Head Chefs) can configure defaults such as OpenTelemetry and web analytics.
- Access control:
  - Hierarchy: a kitchen within a kitchen is allowed.
  - Owner/write/read permissions: each kitchen has a head chef and then each chef gets granular permissions.
  - Should have domain gating and hierarchy.
  - Ideally eventually gets OAuth through Entra/Google etc.

## A feasible working demo
But let's go back to what's demoable now. The specific app that our invited user wants to build is one that:
- Can pull from their existing, real Google Maps to back up all of their saved places.
- They want to be able to tag saved places with a defined number of tags.
- They want an ~unlimited number of saved places.
- They want to be able to share their map with friends.
- Places details should still pull from Google Maps and the buttons should deeplink back out to it, for directions, for example.

### Tech specs
Let's not do login org structure or anything like that at this stage. Just the proof that we can do all the coding steps. Note that means we _do_ need real Daytona, GitHub and Cloudflare integrations.
- Authed user: We don't need multi-user at this point. Just me. And all the steps are hardcoded so we don't need to worry too much about abuse.
- GitHub: each application in a Kitchen is a branch in a private repo for the authed user.
- Cloudflare: We'll deploy the app and its DB here.
- Daytona: A config that gives the 'agent' all of the tools to build (e.g. skills, MCP), connections/deployment (e.g. Cloudflare worker and DB) and secrets (i.e. pre-existing such as Cloudflare or to-be-created such as Google Maps). Once we go multi-user, this config is managed by the Head Chef.
- Agent: We'll use OpenCode as the backend that runs on Daytona and our custom UI to display its responses.

### v0.2 Hardcoded but real

Let's build this app for real, but hardcode all of the exact steps (i.e. 'agent' is sending messages as if it's building but in reality it's following a pre-written set of steps). We'll run them in a Daytona sandbox and deploy to Cloudflare for real.

In the Kitchen platform UI we should be able to hard delete this app afterwards so that we can do it again.

#### v0.2.1 Counter
I think you should first just write a counter app as a proof of concept of the end-to-end flow.

We're still working out the OpenCode aspect, so you can even just build with two buttons: one for build and deploy, one for destroy.

#### v0.2.2 Google Maps alternative
Then come back to me about the Maps alternative.

## Coding agent notes
<!--Communicate here with a timestamp at the start of the line and a terse note afterwards. Note you may be working in a worktree so would need to refer back to the home.-->
2026-08-30: Started v0.2.1 (counter). Real Daytona key is pending approval, so per user direction we're emulating the sandbox step with **Cloudflare's own Sandbox/Containers product** (`@cloudflare/sandbox`) instead -- a real isolated container, not a mock, just a different provider than the eventual Daytona one. Swap-in note for later: both the Daytona key and the Cloudflare API token should end up **per-Head-Chef** credentials (per `02_real_spec.md`'s access-control section), not a single shared one -- flagged by the user, not yet implemented.

Cloudflare credentials obtained and stored in `.dev.vars` (gitignored, read automatically by `wrangler`/adapter-cloudflare's local dev via `platform.env`): `CLOUDFLARE_API_TOKEN` (custom token, "Edit Cloudflare Workers" template + added D1 edit for future v0.2.2 storage needs, scoped to the account) and `CLOUDFLARE_ACCOUNT_ID` (`f73dcd49f24a237136519dc056320d2b`, from `wrangler whoami`). For an eventual real deploy of *this* app (not just the sandboxed counter), these need to become `wrangler secret put` values instead of `.dev.vars`.

Implementation done (typechecks clean via `npm run check`, not yet browser-verified -- see blocker below):
- `package.json`: added `@cloudflare/sandbox` dependency, `@types/node` devDependency (required once `nodejs_compat` is on).
- `Dockerfile`: `FROM docker.io/cloudflare/sandbox:0.12.9` (pinned to match the npm package version).
- `wrangler.jsonc`: added `compatibility_flags: ["nodejs_compat"]`, `containers`/`durable_objects`/`migrations` blocks for the `Sandbox` class, and changed `main` from the adapter's generated `.svelte-kit/cloudflare/_worker.js` to `workers/entry.js`.
- `workers/entry.js`: adapter-cloudflare's generated worker only exports a `fetch` handler with no way to also export a Durable Object class, so this is a thin wrapper that imports the generated SvelteKit worker as its default export and re-exports `Sandbox` from `@cloudflare/sandbox` alongside it. Marked `@ts-nocheck` since it imports a build-output file that only exists after `npm run build`.
- `src/lib/server/counterApp.ts`: `deployCounterApp`/`destroyCounterApp`. Gets a Cloudflare Sandbox (`getSandbox`, fixed id `ivcp-counter-sandbox`), writes a minimal counter Worker (HTML page + Durable-Object-backed increment counter, hand-written, no build step of its own) into `/workspace/counter-app`, then runs `npx --yes wrangler@4.127.1 deploy` / `delete --force` inside the sandbox with the Cloudflare creds passed as per-call `exec()` env vars (never baked into the sandbox image). Deployed URL is scraped from `wrangler deploy`'s stdout via regex, since there's no `--json` output flag confirmed for this wrangler version.
- `src/routes/api/counter/deploy/+server.ts` and `.../destroy/+server.ts`: thin POST handlers calling the above, returning `{ success, log, url? }`.
- `src/routes/dashboard/apps/counter/+page.svelte`: the two buttons ("Build & deploy" / "Destroy") plus a log/URL display, linked from a new "Apps" section on `/dashboard`.

**Blocker (environment, not code):** `npm run build` and `npm run dev` both fail with a misleading "Tsconfig not found" / `node:module` resolve error, reproducible even with all the above changes stashed out (confirmed via `git stash push -u`, so it's pre-existing, not introduced by this work). Root cause: Vite 8 here runs on rolldown's native (Rust) tsconfig auto-discovery, which resolves to `/Users/mbp/Projects/internal-vibe-coding-platform/.svelte-kit/tsconfig.json` -- the **main repo's** root -- instead of this worktree's. This worktree was nested inside the main repo's own working tree (`.claude/worktrees/v2-real-spec`); until today's `Merge branch 'deploy-bootstrap'` landed on `main`, the main repo root had no `package.json`/`tsconfig.json` of its own, so there was nothing to conflate with. Now there is (identical SvelteKit scaffold), and the native resolver's project-root walk-up picks the wrong one. `npm run check` (plain `tsc`/svelte-check) is unaffected and passes clean -- this is specific to rolldown's compiled resolver, not something fixable from `vite.config.ts` (the `oxc`/`OxcOptions` type explicitly omits a `tsconfig`/`cwd` override).

Fix in progress: relocating this worktree to a sibling directory outside the main repo's tree (`/Users/mbp/Projects/ivcp-v2-real-spec`), matching how `ivcp-deploy-bootstrap` was set up, via `git worktree move` run by the user from outside this session (the session's own tools are bound to the old path, so moving it from inside would likely break file access mid-task). **Next agent: once resumed at the new path, run `npm run build` and `npm run dev` to confirm the fix, then click through Build & deploy / Destroy in a browser before calling v0.2.1 done.**

2026-08-30 (later same day): Confirmed the worktree-move fixed the tsconfig/rolldown blocker above. Found and fixed a second, unrelated build blocker: `@cloudflare/sandbox` (via `@cloudflare/containers`) statically imports the real `cloudflare:workers` virtual module, and `@sveltejs/adapter-cloudflare` builds entirely in plain Node (unlike Cloudflare's own official `@cloudflare/vite-plugin`, which runs the SSR build inside workerd) -- so any route/server code reaching that import broke the build with `ERR_UNSUPPORTED_ESM_URL_SCHEME`. Verified precisely by stubbing out `counterApp.ts`'s only real import and watching the build go from crashing to clean. This is a structural incompatibility between `adapter-cloudflare` and any code importing real `cloudflare:*` modules, not a config issue -- ruled out via `vite.config.ts` `external`/`rolldownOptions`/`ssr.external` permutations, the `vite@8.0.16` pin from the `opencode-wiring` worktree's unrelated tsconfig fix, and with/without Tailwind, none of which changed the outcome. Separately patched a real upstream bug while investigating: `@cloudflare/containers@0.3.7`'s published ESM output is missing `.js` extensions on relative imports (breaks under native Node ESM resolution) -- not needed anymore after the rewrite below, but worth knowing about if `@cloudflare/containers` comes back into scope.

The user then clarified the real Daytona key from `01_hardcoded_demo.md`'s "pending approval" note has since landed (found live in the `opencode-wiring` worktree's `.env`, `DAYTONA_API_KEY`) and asked to drop the Cloudflare Sandbox stand-in entirely in favor of real Daytona, matching the original plan and sidestepping the adapter-cloudflare incompatibility above for good (no more `cloudflare:*` imports in app code). Rewrote `src/lib/server/counterApp.ts` on `@daytona/sdk`, following the same `Sandbox`-by-label-lookup pattern already live-verified in `opencode-wiring`'s `src/lib/server/opencode/sandbox.ts`. Removed `Dockerfile`, `workers/entry.js`, and the `containers`/`durable_objects`/`migrations`/`nodejs_compat` blocks from `wrangler.jsonc` (back to the pre-v0.2.1 baseline plus vars); dropped `@cloudflare/sandbox`, `patch-package`, and the `postinstall` patch step from `package.json`; added `@daytona/sdk`; regenerated `worker-configuration.d.ts` via `wrangler types`; added `DAYTONA_API_KEY` to `.dev.vars`.

Hit and worked around three more issues, all confirmed live against a real Daytona sandbox rather than guessed (worth carrying into `opencode-wiring`'s Daytona provider too, since it uses the same `executeCommand`/`cwd` pattern and may be silently relying on lucky path choices):
- Passing a `cwd` to `sandbox.process.executeCommand` routes through a Daytona toolbox code path that shells out via `/usr/bin/zsh` for path expansion, which errors (`fork/exec /usr/bin/zsh: no such file or directory` on one image, `permission denied` on the default snapshot) regardless of the `SHELL` env var or which base image is used. Fix: never pass `cwd`; put `cd <absolute-dir> &&` inline in the command string instead (confirmed this avoids the zsh path entirely and just works).
- Daytona sandboxes sit behind a domain-allowlisting egress proxy: HTTPS to a non-listed domain resets mid-TLS-handshake (not a clean block), and the default allowlist covers npm/etc but not Cloudflare's API -- `wrangler deploy` failed with a generic "fetch failed" until the sandbox was created with an explicit `domainAllowList` covering `api.cloudflare.com,*.cloudflare.com,workers.dev,*.workers.dev` plus npm's registry (passing `domainAllowList` at all *replaces* the default list rather than extending it, so npm's domains have to be repeated in it or `npx wrangler` itself stops working).
- The default Daytona snapshot already has Node/npm preinstalled (`language: 'typescript'`/custom images aren't needed for this workload) -- confirmed via `which node`.

Verified end-to-end for real: `POST /api/counter/deploy` provisions/reuses a labelled Daytona sandbox, writes the counter Worker's `index.js`/`wrangler.jsonc`, and runs `npx wrangler deploy` inside it -- the resulting `https://ivcp-counter-demo.<account>.workers.dev` URL served the real page and a real Durable-Object-backed counter that incremented across requests. `POST /api/counter/destroy` then ran `wrangler delete --force` and the URL confirmed 404 afterward. `npm run check` and `npm run build` both pass clean. Not yet done: a browser click-through of the dashboard buttons (the Chrome extension wasn't connected this session) -- the API-level curl tests exercise the exact same code path the buttons call, but an actual UI pass is still worth doing before calling v0.2.1 fully done.
