# Cloudflare container execution spike

An isolated experiment, not a provider or production feature. It exposes only a fixed `uname -a` probe over HTTP; the arbitrary command RPC is available only to a Worker holding the Durable Object binding. Network access is disabled. The binding-only RPC also offers a port proxy and non-waking status; there is no HTTP endpoint for either. The future application must check app authorization before calling the proxy. The isolated container has no persistence or credentials, and stopping it loses its files. No project data should be put into it.

Prerequisites: a Wrangler version and Cloudflare account supporting Durable Object containers; Docker and a local container runtime where required. Review Cloudflare's current container and Sandbox documentation and costs first. Configure a dedicated random `SANDBOX_PROBE_TOKEN` (at least 32 characters) as a local Wrangler secret, not in source control or logs. Then run from the repo root:

```
npx --yes wrangler@4.166.0 dev --config prototypes/cloudflare-sandbox/wrangler.jsonc
```

POST `/probe` with `Authorization: Bearer <token>`; do not put the token in a command history. An HTTP 200 with `exitCode: 0` confirms only that this isolated container executed one command. It does not validate OpenCode, previews, snapshot restore, lifecycle or production integration. The probe should remain isolated and should not be deployed to the live Vibe Kitchen Worker.

The main application currently expects an HTTP endpoint for OpenCode and uses per-request SvelteKit platform bindings. A complete provider must securely bridge those requests to a project-specific Durable Object, preserve work before idle termination, proxy authenticated preview traffic, provision tools and environment, and integrate file operations and deployment. Cloudflare's SDK 1.0 differs from the older SDK; see https://developers.cloudflare.com/sandbox/get-started/build-a-coding-agent-runner/ and https://developers.cloudflare.com/sandbox/previews/.

## Compatibility observed in this checkout

The repository's Wrangler 4.127.1 rejects `scheduling_policy: durable_object`. The isolated spike successfully bundled with Wrangler 4.166.0 using `npx --yes wrangler@4.166.0 deploy --dry-run --config prototypes/cloudflare-sandbox/wrangler.jsonc`. The main application dependencies have not been upgraded. Docker is not installed in this session, so container execution has not been tested. Do not interpret this as a working Cloudflare provider.

## Remaining integration

1. Provide a separate Worker entry point that exports both SvelteKit's handler and the Durable Object class; bind that class using a Wrangler version supporting the durable-object container policy. Keep the existing production config unchanged until this is verified.
2. Pass the project-specific binding into the provider with request context. The `cloudflareAgentTarget` and `cloudflarePreviewTarget` helpers in `src/lib/server/opencode/cloudflare-transport.ts` connect the resulting RPC proxy to the existing authorized OpenCode, event-stream, and preview routes.
3. Implement project initialization, OpenCode process startup/readiness, skills and secrets, file operations, export/restore, and concurrent provisioning. Avoid feeding arbitrary repository code broad deployment credentials.
4. Define how unsaved edits survive container idle/termination and test interruption and recovery. Existing R2 snapshots happen on deploy, teardown and explicit save, not every change; restoring an old snapshot after unexpected loss is not a guarantee of durability. Until this is solved, selection of the Cloudflare provider fails closed.
5. Test locally with Docker and compatible Wrangler, then in a separately configured Cloudflare account/environment. Verify authenticated previews, real model calls, sandbox stop/resume, snapshots, and project isolation before production use.

Transport unit tests: `node --test tests/unit/opencode-transport.test.mjs`. Project checks: `npm run check` and `npm run build`. The isolated spike bundles using the Wrangler 4.166.0 dry-run command above.

## Per-app binding bridge

`cloudflare-project.ts` provides a tested, binding-only handle for a canonical App UUID. It derives one Durable Object name per app and routes agent and preview requests to that app's bridge; it does not start a sandbox. The eventual request handler must call `requireAppAccess` before resolving this handle. The handle is not wired into provider selection: provisioning, persistence and an isolated live test remain prerequisites to enabling Cloudflare.

Run its isolation and validation tests with `node --test tests/unit/cloudflare-project.test.mjs`.
