# Spec: OpenCode as agent backend, our UI as frontend

## Decision

Per [`02_agent_interface.md`](./02_agent_interface.md) and the follow-up UI-reuse investigation, we run **anomalyco/opencode's server** (`packages/server`) as the agent backend inside each Daytona sandbox, and keep **our own SvelteKit UI** (already visually cloned from opencode's web app) as the only user-facing surface. We do not adopt opencode's `packages/app` SPA — it owns its own page/routing and has no auth or multi-tenant model, which would fight our login/Kitchens/dashboard flow rather than support it. We get opencode's protocol, not its frontend.

This supersedes the "target Codex directly" decision — the backend agent is now opencode itself (which can call whichever model a Kitchen is configured for, including OpenAI's Codex-family models), not the raw Codex CLI/SDK.

## Architecture

```
Browser (our SvelteKit UI)
     │  HTTPS (our own auth: session cookie / magic link)
     ▼
Our app server (SvelteKit endpoints)
     │  proxies to, and holds the credential/URL for, one opencode server per project
     ▼
Daytona sandbox (per project/"Kitchen" session)
     └── opencode server process (packages/server)
              ├── REST: session + message CRUD
              ├── SSE: /api/event (global), /api/session/:id/event (durable, resumable)
              └── the actual coding agent loop, calling out to whichever
                  model provider the Kitchen's config specifies
```

The opencode server is never exposed directly to the browser. Our app server is the only thing that holds the sandbox's address/credentials, and it proxies REST calls and re-streams SSE to the browser over our own connection (e.g. re-emitted as a same-origin SSE/WebSocket from our SvelteKit backend). This keeps auth, per-Kitchen permissions, and audit logging in our layer, where the "chef" role model and approval flows actually live — none of which opencode's server or `packages/app` know anything about.

## Session lifecycle

1. User starts or resumes a project ("Kitchen" project) in our UI.
2. Our app server ensures a Daytona sandbox exists for that project (create-or-resume; out of scope for this doc — see the open Daytona questions in `01_hardcoded_demo.md`) and that an opencode server process is running inside it.
3. Our app server calls `POST /api/session` on the opencode server to create a session, or reuses an existing `session_id` stored against the project if one is already open.
4. User input (text, or the transcribed/attached spec video) is submitted via `POST /api/session/:id/prompt`.
5. Our app server subscribes to `GET /api/session/:id/event` and re-streams events to the browser. On any dropped connection, we reconnect with `?after=<last_seen_seq>` so we never lose or duplicate events — this is the specific capability that made opencode the pick over Pi/Codex.
6. Message history for a reopened session is backfilled via the paginated `GET /api/session/:id/message` before live events resume, so refreshing the page or returning later shows the full transcript.

## Mapping opencode events to our UI

Our chat UI (`src/lib/components/{Composer,ChatMessage,ToolCall}.svelte`, `src/routes/chat/+page.svelte`) already assumes this shape conceptually; the real integration replaces the hardcoded `stage` state machine with a reducer driven by the event stream:

| opencode concept | Our UI element |
|---|---|
| A session's projected message list | The scrolling timeline (`ChatMessage` per turn) |
| Assistant text content | `ChatMessage role="agent"` body, rendered as markdown |
| A tool-call / file-edit content part | `ToolCall.svelte` — pending state while in-flight, collapses to a one-line summary when the corresponding part completes |
| User-submitted prompt (including attachments) | `ChatMessage role="user"`, with the attachment chip already built into `Composer.svelte` |
| Session busy / agent generating | `Composer`'s `busy` prop (submit button → stop affordance), plus `.text-shimmer` on the active tool-call line |
| A running dev server / preview URL surfaced by the sandbox | The side panel's Preview tab (`app-preview`) — how the dev-server URL actually reaches us from inside Daytona is not yet designed; likely a Daytona-exposed port forwarded through our app server, unrelated to opencode's own protocol |

The exact field names of opencode's message/event payloads (e.g. how a tool-call part is distinguished from a text part in the SSE stream) weren't captured verbatim during research — before wiring the reducer, pull a live trace from a real opencode server (`POST /api/session`, `POST /api/session/:id/prompt`, watch `/api/session/:id/event`) rather than assuming field names from the protocol source alone.

## Model/provider config

opencode's provider is configured per its own config file (referenced in `packages/llm`), taking an arbitrary model id string against a generic provider adapter (OpenAI, Anthropic, etc. all supported this way). Our Kitchen config (still being worked out per `01_hardcoded_demo.md`) needs one more field: which model id and provider credentials that Kitchen's opencode server should be started with. This is a config-generation concern on our side (write the right `opencode.json` into the sandbox before starting the server), not something opencode needs to know about our Kitchen/chef model at all.

**Current state is a first cut and fragile — worth revisiting:** the platform default model ("Luna", `gpt-5.6-luna` under opencode's built-in `openai` provider) is registered by hand-writing `~/.config/opencode/opencode.json` as a shell string in `sandbox.ts`'s `ensureModelConfig`/`opencodeConfig`, gated only by a `test -f ... && echo present` check that never rewrites an existing file — so a config change (e.g. swapping Luna's model id) silently won't reach any sandbox provisioned before the change. The Kitchen-level override (`kitchens.default_model_id`/`default_model_provider_id`, set via `POST /api/kitchen/[projectId]/kitchen-default-model`) is validated against the model's `id`+`providerID` at resolution time in the `/models` route but not against opencode's actual config, so a Head Chef can set an override to a model id that isn't (or is no longer) registered in that Kitchen's sandboxes — it'll just silently fail the `find()` and fall back to Luna. There's also no way to add a *second* custom model or provider without editing `opencodeConfig()` in code and re-provisioning. Local dev (`LocalProcessSandboxProvider`) doesn't get Luna at all (deliberately, to avoid touching a developer's real global opencode config), so its model list quietly diverges from Daytona. All of this could reasonably be replaced by a proper Kitchen-scoped model/provider config surface once the shape of "Kitchen config" above is actually settled, rather than the current one-off default-model plumbing.

## Non-goals / explicitly out of scope for this spec

- Reusing opencode's `packages/app` SPA, `packages/console`, or `packages/enterprise` — decided against; see the UI-reuse investigation above.
- Running the actual Codex CLI/SDK subprocess protocol from `02_agent_interface.md` — no longer the plan; kept in that doc as a reference in case we ever need a second, opencode-bypassing integration path.
- Daytona sandbox provisioning/lifecycle mechanics — tracked separately in `01_hardcoded_demo.md`'s open questions.

## Open questions

- Exact SSE payload shape for tool-call parts (needs a live trace, see above).
- How the sandbox's dev-server preview URL and the opencode server's own address are both surfaced through Daytona to our app server — likely two different exposed ports, not yet designed.
- Whether one opencode server process is reused across a project's full lifetime or spun up per session — affects how aggressively we can rely on the durable SSE replay versus needing our own event persistence layer as a backstop.
- Auth between our app server and the opencode server inside the sandbox (network-level trust via Daytona's isolation, vs. a token) — not yet decided.
