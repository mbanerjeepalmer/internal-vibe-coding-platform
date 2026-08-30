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
- Required Worker secrets already configured in production: `DAYTONA_API_KEY`,
  `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `BETTER_AUTH_SECRET`,
  `BETTER_AUTH_URL`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL`.
- Add or rotate a production value with `npx wrangler secret put NAME`; do not
  add secret values to `wrangler.jsonc`, `.dev.vars`, commits, or terminal
  output.

## Normal development loop

1. Inspect the current Git status and preserve unrelated user changes.
2. Run `npm ci` after a lockfile change or in a fresh worktree.
3. Run `npm run check` and `npm run build` before proposing a deployment.
4. Add each D1 schema change as the next numbered SQL file in `migrations/`.
   Apply it locally first where practical; apply production migrations with
   `npx wrangler d1 migrations apply ivcp-control-plane --remote` only when the
   schema is ready to ship.
5. Regenerate Worker bindings after `wrangler.jsonc` changes with
   `npx wrangler types` and commit `worker-configuration.d.ts` if it changes.
6. For a release, run `npx wrangler deploy`, then make a read-only request to
   the affected `https://vibe.kitchen` route to verify it.

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
