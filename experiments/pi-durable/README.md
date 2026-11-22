# Pi Durable local spike

A small standalone experiment, not a Vibe Kitchen agent backend. It exercises the real Pi Durable 1.6 harness and coding tool with a scripted faux model, writing only to an OS temporary directory. No provider credentials or network calls are used by the smoke test.

```sh
cd experiments/pi-durable
npm ci
node smoke.mjs
```

The smoke test checks a tool call that writes a file, a successful response, reopening a SQLite-backed conversation, and retrying an already completed submission with the same request ID. It does **not** test mid-turn crash recovery, simultaneous clients, the OpenCode web protocol, real models, Daytona or Cloudflare sandboxes. Node 24 was used.

## Integration work still required

- The production UI consumes OpenCode-specific session, model, permission and resumable SSE payloads. Build an agent-neutral application contract and an adapter for Pi Durable's views/events, or migrate the UI; do not pretend the two event formats are interchangeable. Preserve server-side app authorisation for every endpoint.
- Choose and persist a backend per conversation. Do not pass an OpenCode session ID to Pi or silently replace a live conversation when changing backend. Make an explicit fresh conversation on switch, preserving the prior one.
- Pi Durable is the harness, not a ready-made coding server. The spike uses the Node execution environment. Production tools must address the selected isolated sandbox, independent of the Pi harness location, and protect access to workspaces and credentials.
- Cloudflare offers PiHarness, backed by Durable Object SQLite and lifecycle wakeups: https://developers.cloudflare.com/agents/harnesses/pi/. A sandbox needs its own execution integration: https://developers.cloudflare.com/agents/tools/sandbox/. Validate both providers (Daytona and Cloudflare), transport, authentication, workspace lifetime and cancellation.
- Pi's harness state and workspace files are separate. Test loss/recreation of either independently, duplicate requests, reconnection and an interruption during a shell operation. Do not automatically retry irreversible effects. The demo's completed-request retry is not proof of crash recovery.
- Pin compatible Pi and `agents` SDK versions. The Cloudflare docs warn that Pi minor upgrades can make storage unreadable by the older version, complicating rollback. Test migration and recovery before deployment.
- Production model credentials should stay outside an agent-controlled shell where feasible. The demo uses a faux provider and validates no real provider access.
