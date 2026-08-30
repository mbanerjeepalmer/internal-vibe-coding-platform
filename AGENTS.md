# Build and deploy runbook

This worktree is for the Vibe Kitchen wrapper: Better Auth/Resend,
organisation → Kitchen → App control-plane work, invitations, the dashboard,
simple environment-variable secrets, and their integration with the existing
OpenCode/Daytona workspace.

## First principles

- Work from this sibling worktree. Do not move it inside another checkout:
  Vite/rolldown can resolve the wrong SvelteKit project root in nested Git
  worktrees.
- Preserve the real core. OpenCode remains the agent backend in Daytona; our
  SvelteKit application is the authenticated control plane and browser-facing
  UI.
- Enforce access on the server. An app/project ID in a URL is an identifier,
  never authority. Resolve the Better Auth session, App, Kitchen and effective
  membership before any sandbox, OpenCode, preview, deploy or delete action.
- Never put credentials in source, committed configuration, prompts, URLs,
  browser state, SSE payloads, or logs. Worker secret *names* are safe to
  mention; values are not.

## Existing production configuration

- Production worker and custom domain: `ivcp-opencode-wiring` at
  `https://vibe.kitchen`.
- D1 control plane binding: `DB` → `ivcp-control-plane`; migrations live in
  `migrations/`.
- Check which Worker secrets are currently configured in production with
  `npx wrangler secret list` — don't rely on a hardcoded list here, since it
  drifts out of sync with reality. (A hardcoded list in this file once missed
  a newly-required secret; that would have broken session creation in
  production had it shipped before the gap was caught.)
- Add or rotate a production value with `npx wrangler secret put NAME`; do not
  add secret values to `wrangler.jsonc`, `.dev.vars`, commits, or terminal
  output.

## CI/CD

`.github/workflows/ci.yml` runs on every push and PR:

- `check` job: `npm ci`, `npm run check`, `npm run build`. Runs for every push
  and PR, including `main`.
- `deploy` job: only on a push to `main` (not PRs), after `check` passes.
  Applies pending D1 migrations with
  `npx wrangler d1 migrations apply ivcp-control-plane --remote`, then runs
  `npx wrangler deploy`. Requires the `CLOUDFLARE_API_TOKEN` and
  `CLOUDFLARE_ACCOUNT_ID` repository secrets (Settings → Secrets and
  variables → Actions) — same values as the `.dev.vars`/Worker secrets of the
  same name, added there separately since Actions can't read Worker secrets.

This means **a push to `main` deploys to `https://vibe.kitchen` automatically
once the checks pass** — there is no separate manual release step. Land
changes through a branch/PR when you want checks to run before they reach
`main`.

## Normal development loop

1. Inspect the current Git status and preserve unrelated user changes.
2. Run `npm ci` after a lockfile change or in a fresh worktree.
3. Run `npm run check` and `npm run build` before pushing — CI runs the same
   checks, but catching failures locally avoids a red `main` build.
4. Add each D1 schema change as the next numbered SQL file in `migrations/`.
   Apply it locally first where practical; production migrations are applied
   automatically by CI on push to `main` (see CI/CD above) — do not also run
   `wrangler d1 migrations apply --remote` by hand against `main`'s state
   unless CI is broken.
5. Regenerate Worker bindings after `wrangler.jsonc` changes with
   `npx wrangler types` and commit `worker-configuration.d.ts` if it changes.
6. After a push to `main` deploys, make a read-only request to the affected
   `https://vibe.kitchen` route to verify it.

## Instructing the agent that builds Kitchen apps

Every project's sandbox starts from `starterFiles()` in
`src/lib/server/opencode/sandbox.ts`, which seeds `wrangler.jsonc`, `index.js`
*and* an `AGENTS.md` — opencode reads that file from its working directory as
project instructions, the same convention this file follows for us. That
seeded `AGENTS.md` is the only place the coding agent is told what makes an
app it writes actually deployable: only what the Worker's `fetch` handler (or
its Static Assets config) serves is live after `wrangler deploy`, so writing
`index.html`/`app.js`/`styles.css` on their own does nothing — confirmed live,
where an agent reported a finished to-do app while the deployed Worker still
served the untouched "Hello from vibe-…" placeholder. Keep that seeded file's
guidance (Static Assets vs. inline responses, preserving `wrangler.jsonc`'s
`name` and `workers_dev` subdomain, installing dependencies before Deploy,
Workers-vs-Node runtime) in sync with reality as the starter scaffold or
deploy flow changes. This is a stopgap for wrapper step 5 below (durable
per-Kitchen/App skills); once that exists, review whether this hardcoded file
should move there instead of living only in the generic starter.

## Wrapper implementation order

1. Finish the authenticated organisation/Kitchen/App dashboard and invitation
   acceptance flow that use the D1 control plane.
2. Route the live OpenCode workspace through an authorised App record; migrate
   raw `projectId` URL handling to server-authorised app selection.
3. Give each App a durable branch in the organisation repository before its
   sandbox is started. Sandboxes are disposable; Git holds source/history.
4. Add Kitchen/App secret UI and encrypted storage. Kitchen variables are
   inherited by its Apps; App variables override the same name. Tell agents
   only variable names (for example `GOOGLE_MAPS_API_KEY`) and inject values at
   process/runtime launch rather than into chat.
5. Add skills only after the above is working: Kitchen defaults plus App-level
   selection, materialised into the sandbox as agent instructions/skill files.

## Release guardrails

- Do not deploy an unverified build.
- Do not overwrite or delete a D1 database, production Worker, Kitchen, App,
  sandbox, source branch or secret unless explicitly asked.
- Before changing routes, bindings, secrets or deployment credentials, inspect
  `wrangler.jsonc` and the existing production binding names.
- `vibe.kitchen` is the production custom-domain route. Retain it in
  `wrangler.jsonc`; omission changes Wrangler's deploy behaviour.
