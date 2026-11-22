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
