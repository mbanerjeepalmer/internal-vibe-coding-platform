# Agent interface: targeting Codex

## Decision

We're building the real (non-hardcoded) integration against **OpenAI Codex only**, run inside a Daytona sandbox. We looked at whether a vendor-neutral normalized event schema was worth building up front (see prior research below) but are deferring that — we'll integrate Codex directly and keep this doc updated with what would need to change to support another agent later, rather than build an abstraction for agents we're not running yet.

## Codex's interface

Two ways to embed it:

- **SDK** (`@openai/codex-sdk` for TS, `openai-codex` for Python) — a thin wrapper (`startThread()`, `run()`, `resumeThread()`) that talks JSON-RPC to a local "Codex app-server" process. `run()` is completion-oriented in its own docs — no publicly documented token-level streaming event schema at this layer.
- **CLI, non-interactive** (`codex exec --json`) — JSONL to stdout, which is the layer with a documented streaming shape:
  - Thread/turn lifecycle: `thread.started`, `turn.started`, `turn.completed` / `turn.failed`
  - Discrete work inside a turn: `item.started` / `item.completed`, where each item has a `type`: `agent_message`, `command_execution`, `file_change`, `web_search`, etc.
  - No confirmed token-level text delta — `agent_message` items appear to complete as a whole rather than streaming word-by-word (unconfirmed either way; worth checking against a live run before assuming).

Sandbox mode is a first-class per-turn setting (`Sandbox.read_only` / `workspace_write` / `full_access` in the Python SDK) — this maps directly onto how we'd configure filesystem permissions for the Daytona container, so it's one less thing we have to invent ourselves.

Session resumption: `resumeThread(id)` (SDK) — straightforward id-based resume, no sequence-number replay semantics.

## How this differs from the others (for later reference)

| | Codex | Claude Code | opencode | Pi (`earendil-works/pi`) |
|---|---|---|---|---|
| Primary integration surface | SDK (JSON-RPC to local app-server) or CLI `exec --json` | Agent SDK or CLI headless (`-p --output-format stream-json`) | HTTP+SSE server, OpenAPI SDK | SDK, or CLI `--mode json` / `--mode rpc` |
| Streaming granularity | Item-level (`item.started`/`completed`); token deltas unconfirmed | Token-level deltas via `stream_event` | Per-session SSE, message-part granularity | Token-level deltas, keyed by `contentIndex` |
| Tool call shape | `item` typed `command_execution` / `file_change` | `tool_use` / `tool_result` content blocks inside `assistant`/`user` messages | Message content parts (not directly inspected) | `tool_execution_start` / `_update` / `_end` with `toolCallId` |
| Session resume | `resumeThread(id)` — id only | `--resume` / `--continue` + `session_id` | Durable per-session SSE, resumable via `?after=<seq>` (replays missed events) | `--session` / `--fork` |
| Sandbox/permissions | First-class per-turn setting (`read_only`/`workspace_write`/`full_access`) | `permissionMode` + hooks | Not inspected | Deliberately none — host app must implement |

opencode's resumable, sequence-numbered SSE stream is the most robust of the four for surviving a dropped connection; Codex's plain JSONL stdout has no equivalent, so if we need "reconnect and catch up" behavior for the UI after a network blip, that's on us to build (e.g. persist the JSONL turn/item events ourselves as we consume them, keyed by turn, rather than relying on Codex to replay).

## Open question, not yet resolved

Zed's "Agent Client Protocol" (ACP) reportedly targets exactly this cross-agent normalization problem. We haven't verified its spec — flagging it here so that if we ever do want to run a second agent behind this UI, checking whether Codex/others already speak ACP is the first thing to do before hand-rolling an adapter layer.
