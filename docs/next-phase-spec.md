# Vibe Kitchen: next phase

Status: draft for discussion, 22 November 2026.

## Goal

Make Vibe Kitchen a reliable multiplayer environment for building and deploying real applications. The immediate goal is to establish the platform prerequisites for building applications, including Vibe Kitchen itself: connect a repository, work on a branch with an agent, run and preview it, and deploy safely. The language-learning app is a subsequent use of the platform; its specific features are out of scope. Cloud-hosted work is the immediate priority; a simple way to connect a local coding agent is a later capability.

## Current starting point

- The app is SvelteKit on Cloudflare Workers, with D1 for the control plane and R2 for app source snapshots.
- `src/lib/server/opencode/sandbox.ts` defines a provider interface with Daytona and local-process implementations. Selection currently depends on whether `DAYTONA_API_KEY` is present. The interface also embeds OpenCode and Wrangler deployment assumptions.
- OpenCode runs in the sandbox; the platform provides previews, file operations, source export and Cloudflare deployment. Deploy currently applies D1 migrations and runs Wrangler in the sandbox; app URLs are extracted from Wrangler's workers.dev output.
- Snapshots exclude Git metadata, so restoring a source snapshot is not equivalent to restoring a repository, its branch or uncommitted Git state.
- Existing app/kitchen secrets and secret-request UI provide a starting point. Their actual protection and deployment behavior need a code review and live test; instructions to an agent alone cannot enforce secrecy.
- The reported Daytona failure is not yet diagnosed. Do not assume a particular cause or imply Cloudflare has been validated in this codebase.

## Phase 1: unblock development

1. Add an explicitly configured Cloudflare sandbox backend, retaining Daytona. Fail clearly if the chosen provider is unavailable or misconfigured; do not silently fall back to a local process in production.
2. Support the existing essential operations: isolated per-app execution, files, long-running agent and dev server processes, authenticated preview, lifecycle/status, and source recovery. Test fresh and resumed environments, concurrent provisioning, idle shutdown and failure reporting. Verify Cloudflare SDK compatibility with the SvelteKit adapter and Workers bindings early; earlier repository experiments had integration trouble.
3. Separate sandbox operations from agent-specific startup and deployment only as much as needed to support the new backend. Avoid a general plugin framework.
4. Run the existing OpenCode flow on Cloudflare first, so a working environment does not depend on a simultaneous agent rewrite. Investigate the Daytona failure separately and report a useful error.
5. Prove the workflow with a small persistent app: prompt, edit, install, run, preview, restart/recover, deploy, and reopen. Record setup, costs, limitations, and actual results.

## Agent direction

Support a configurable choice between OpenCode and a Pi Durable-based agent alongside the configurable choice between Daytona and Cloudflare. Implement OpenCode on Cloudflare first to unblock development, then implement and validate Pi Durable. Pi Durable is an agent-building framework, not automatically a drop-in replacement for the Pi coding agent or OpenCode. Spike its coding tools, streaming, model credentials, cancellation, session history and recovery against our UI and Cloudflare runtime; check where the durable runtime and its storage can actually run. Persist conversation and workspace state separately: resuming an agent does not itself restore unsaved files or undo a partly completed external action. Exercise interruption during a shell command and deployment, avoiding duplicate side effects. Keep OpenCode working until the replacement meets these checks. Avoid promising seamless switching or a multi-agent abstraction before it is needed.

## GitHub, branches and self-hosted development

- Connect a GitHub account or installation with access limited to selected repositories; support importing an existing repository and selecting or creating a branch. Keep repository identity, branch and commit visible. Never overwrite an existing workspace on reconnect.
- Let the user inspect changes, commit and push to a branch, and open a pull request. Handle revoked access, conflicts, failed pushes and existing uncommitted changes explicitly. Preserve uncommitted work through sandbox loss; Git pushes and durable snapshots have distinct roles.
- Do not use a snapshot that omits `.git` as a complete Git backup. Define and test how work is restored, including uncommitted changes, without restoring credentials or silently losing history.
- Prove this on Vibe Kitchen's own repository: a separate branch and isolated preview environment, its own D1/R2 resources and secrets, a test suite, and a deployment path. A preview must never accidentally write to production data or replace the live control plane.
- Support a straightforward CI/CD path from the repository to the intended Cloudflare target. Specify which branch deploys which environment and show the deployed commit and errors. CI must run without an interactive sandbox. Do not invent a second deployment mechanism if the existing GitHub/Cloudflare flow suffices.

## Secrets and permissions

- Audit existing encryption, key storage, role checks, secret injection, logging and rotation before declaring them secure. Show secret names and presence, never values, in normal UI; accept values in a write-only form, not chat or source control. Scope secrets to app and environment, with explicitly shared kitchen values where needed.
- Separate development, preview and production credentials and databases. Prefer narrowly scoped, short-lived credentials or a platform-mediated action to injecting broad Cloudflare or GitHub tokens into an agent-controlled shell. An agent with shell access can read environment variables and exfiltrate them: masking output and prompting the model are not security boundaries.
- Prevent secrets and environment files from entering snapshots, logs, exports or commits; test redaction and rotation. Restrict preview access and authorise each project operation. Document what members can see and do.
- Review deploy and undeploy authority: project-controlled Wrangler configuration and scripts are untrusted. Validate target ownership outside the project workspace and avoid running arbitrary repository code with account-wide deployment credentials.

## Deployment and naming

Provide a readable, stable app slug, for example `language-lab.apps.vibe.kitchen`, with branch-specific preview names where practical. Keep an immutable internal app ID separate from the slug, validate/reserve names and handle collisions, renames and cleanup. Confirm wildcard DNS, Cloudflare routing, TLS, account limits and tenant isolation in a spike before committing to a URL design. Show build and migration failures, deployment status, URL and deployed commit. Preserve database data between deployments and isolate previews.

For now, an explicit user deploy action is sufficient. More elaborate deployment gating is future work. Production schema migrations need special care: if migration succeeds and deploy fails, report the partial state and provide a recovery path; no automatic claim of rollback.

## Multiplayer and local connection

Multiple authorised people should see the same conversation and workspace state and be able to reconnect without losing work. Define a single writer or clear coordination for concurrent edits, agent turns and deploys; surface conflicts instead of silently overwriting changes. Test simultaneous sessions and reconnection.

Later, explore a small authenticated local connector for a developer's existing Claude Code, OpenCode or Codex session. First establish which tools expose supported integration interfaces and how session, filesystem access and user consent work. Do not assume interchangeable protocols or expose a laptop shell to the public internet.

## Acceptance criteria

- A new or imported app runs on the selected Cloudflare sandbox, can be previewed by authorised users, survives an idle/restart cycle without losing work, and deploys successfully.
- Two authorised users can join the same app, see updates and avoid silent conflicting writes.
- A GitHub branch of Vibe Kitchen can be imported, changed, tested and pushed; its preview runs against separate non-production resources.
- App and environment secrets can be supplied and rotated without entering chat or Git; access is scoped and tested, and the documented threat model reflects shell access.
- The platform supports persistent app data and scoped third-party service credentials in development and deployment; application-specific features are out of scope.
- User-facing URLs are meaningful once the naming/routing spike succeeds; errors identify actionable next steps.

## Decisions to discuss

1. Who should be able to deploy to production in a shared kitchen? Default proposal: authorised app members can deploy previews; production deploy is an explicit action restricted to the owner or designated role.
2. Is a custom `apps.vibe.kitchen` domain acceptable for deployed apps, subject to the routing spike? Branch previews can have separate, non-production URLs.

## References

- Cloudflare coding agents: https://developers.cloudflare.com/sandbox/coding-agents/
- Cloudflare sandbox runner: https://developers.cloudflare.com/sandbox/get-started/build-a-coding-agent-runner/
- Pi Durable and Pi: https://pidurable.com/learn/pi-durable-vs-pi
