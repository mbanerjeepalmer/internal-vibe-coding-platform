# Internal vibe coding platform

In `docs/04_tighter_end_to_end.md` we are currently building the real core. Now in addition to that, we want to start wrapping it, layer by layer.

## First wrapper scope

We will add the wrapper in this order, stopping to agree each layer before
specifying the next:

1. multi-user access with Better Auth and Resend;
2. a basic two-level hierarchy dashboard;
3. secrets at Kitchen and app scope; and
4. skills.

The top level is an **organisation container**, not a Kitchen in which people
build apps. It owns members, child Kitchens, the durable history/state of all
work, and the shared infrastructure needed to manage sandboxes. An app belongs
to exactly one child Kitchen. There are no deeper Kitchen levels in this first
version.

## 1. Multi-user access

### Goal

Replace the current single-user/demo assumptions with a real, server-enforced
answer to: *who is this person, which Kitchen do they belong to, and which apps
may they use?* This is the prerequisite for exposing any sandbox, conversation,
preview, deployment or deletion operation to more than one person.

### Authentication

- Use **Better Auth** for user accounts, sessions and email verification.
- Use **Resend** as Better Auth's transactional-email delivery provider.
- Start with Better Auth's passwordless **magic-link** flow, with Resend
  delivering the link. It keeps invitation acceptance to one click after an
  email address has been entered. Do not build passwords, one-time-code entry
  or social sign-in in this phase.
- A session identifies a `User`; every page and API route deriving project or
  Kitchen data resolves it from that session on the server.

### Minimum persistent records

| Record | Purpose |
|---|---|
| `User` | Better Auth's authenticated person, with verified email and display profile. |
| `Organisation` | The top-level operational container. It owns all child Kitchens, memberships, project history and sandbox-management state. |
| `OrganisationMembership` | A user's relationship to the organisation. At this stage its role is `owner` or `member`. |
| `Kitchen` | A direct child of one organisation; its configuration will later select allowed secrets and skills. |
| `KitchenMembership` | A user's membership in one Kitchen, with role `head_chef` or `chef`. An organisation owner is implicitly able to administer every child Kitchen. |
| `Invitation` | A pending, single-use grant of organisation and/or Kitchen membership to one email address. |

The organisation container is the authoritative home for durable state. It
will ultimately reference each app's source repository/revision history,
OpenCode-session history, sandbox identity/lifecycle, deployments and audit
history. The exact persistent code-store design is deliberately deferred until
the dashboard/app model: it must be a real, durable git-backed location, not a
Daytona sandbox filesystem. Sandboxes are execution environments and can be
destroyed without destroying source or history.

### Roles in this slice

- **Organisation owner** can create child Kitchens, manage organisation
  membership, see all state/history and administer sandbox lifecycle across
  the organisation.
- **Head Chef** administers the Kitchen to which they are assigned and its
  apps.
- **Chef** works only in apps belonging to Kitchens to which they are assigned.

There is no Viewer role, per-app exception list, nested Kitchen inheritance or
generic permission editor yet. Those would obscure the simple membership model
before we have exercised it.

### Invitation flow

1. An organisation owner or eligible Head Chef enters an email address and
   selects the target Kitchen and role.
2. The app creates an invitation with an opaque, single-use token, expiry and
   target email address; it sends the acceptance link through Resend.
3. The recipient signs in using that exact email address. If they do not yet
   have an account, Better Auth creates/validates it through the same flow.
4. The app atomically consumes the invitation and creates the intended
   membership(s). A consumed, expired or revoked invitation cannot be reused.

Invitations must be revocable. The token is stored only as a secure hash, and
the invitation email must not disclose any secret or privileged configuration.

### Enforcement boundary

The browser may navigate to an app URL, but it does not establish authority by
supplying an app or project identifier. On every route that currently accepts
`[projectId]`, the server must:

1. read the authenticated Better Auth session;
2. load the app/project record from durable storage;
3. resolve its Kitchen and organisation;
4. verify effective membership and role for the requested operation; and only
   then
5. obtain or operate the matching sandbox/session/deployment.

The existing Daytona label and OpenCode session ID become metadata on the app
record, never permission-bearing user input. Unauthenticated requests receive
no project, sandbox or preview detail; unauthorised requests are rejected even
when a caller knows the identifier.

### Completion criteria for this layer

- Two people can sign in through email and have independent sessions.
- An owner can invite a Chef to one Kitchen; the Chef cannot open another
  Kitchen's apps by modifying a URL.
- Existing `/live` and sandbox-destroy endpoints use server-side membership
  checks instead of trusting `?project=` or raw route IDs.
- Source/history have a durable app-level home independent of a sandbox,
  even if the first implementation supports only one repository provider.
- Every membership, invitation and sandbox-destruction action is recorded in
  durable history with actor and timestamp.

## 2. Two-level dashboard

### Goal

Give people one clear route from the organisation they belong to, through a
working Kitchen, into a durable app workspace. This is deliberately a
two-level model:

```
Organisation (management container)
└── Kitchen (working space)
    └── App (one durable coding project)
```

The organisation is not an additional Kitchen and does not contain apps. A
Kitchen cannot contain another Kitchen. We can revisit delegated hierarchies
only after this simpler shape has been used in practice.

### Naming

Use **App** in the product UI: it is the thing a Chef is trying to build and
deploy. Use a stable `appId` in the control plane. Existing code that calls
this a `projectId` should migrate to the stored `appId` rather than expose the
old identifier as an authority token. “Project” can remain a descriptive term
in technical documentation when useful, but it must mean the same thing.

### Organisation dashboard

The organisation dashboard is the initial landing page after sign-in. It is a
management overview, not a work queue.

- Show the Kitchens the signed-in person may enter. For each: name, Head Chef,
  number of members, number of apps, and a compact recent-activity/status
  summary.
- Organisation owners additionally see controls to create a Kitchen, invite or
  remove organisation members, and open organisation-wide history.
- The organisation owns sandbox-management state. Its history view can show
  which sandboxes are active, stopped or destroyed, and which app each belongs
  to; it is not an invitation to operate another Kitchen's app without the
  relevant role.
- A non-owner sees only Kitchens to which they have a direct
  `KitchenMembership`. An empty state explains that they have not yet been
  invited to a working Kitchen.

No “outstanding items”, alerts centre or approval queue is required for this
slice. Those belong only when approval/deployment policy is specified later.

### Kitchen dashboard

Entering a Kitchen shows its durable app list and the people who belong to
that Kitchen.

- Each app card shows its name, creator, latest activity, source revision,
  current sandbox state, last deployment state and a **Open workspace** action.
- A Head Chef can create an app, invite/manage Kitchen members, open app
  history, and view the Kitchen's configuration summary. The latter is
  read-only until secrets and skills are specified.
- A Chef can create an app only if their Kitchen membership permits it, and can
  open apps they are permitted to use. For the initial model, all Chefs in a
  Kitchen can see and work on all of that Kitchen's apps; per-app access lists
  are explicitly out of scope.
- The app workspace is the existing live OpenCode experience, now reached via
  `/apps/<appId>` (or an equivalent stable route), not `/live?project=…`.
  The server uses the app record to find its OpenCode session and sandbox.

### App as the durable join point

An `App` record belongs to one Kitchen and is the single durable join point for
state currently spread across URLs and the sandbox:

| App data | Why it persists outside the sandbox |
|---|---|
| Name, creator, Kitchen and creation time | Enables dashboard and access checks. |
| Git repository identity and default branch | The source of truth for code and revision history. |
| Current revision and deployment references | Ties an agent conversation and deploy to a reproducible source revision. |
| Daytona sandbox identity and lifecycle state | Lets the organisation safely resume, stop or destroy execution capacity. |
| OpenCode session identity and conversation/run history | Lets a user resume the app after a browser or sandbox restart. |
| Future secret and skill bindings | Makes effective configuration explicit and auditable. |

Git is the durable code store. The first implementation uses **one private
organisation-owned repository**. Each App receives a managed branch from the
organisation's configured base branch; the App record stores that repository
identity, branch and current revision. This is an implementation choice, not a
permanent product boundary: we may move to one repository per App later. The
dashboard must not make the Daytona filesystem appear durable or authoritative.

### Basic lifecycle

1. A Head Chef or permitted Chef creates an app in a Kitchen and supplies its
   name/template.
2. The application creates the durable App record and its git home before
   starting the sandbox.
3. Opening the app checks Kitchen membership, then resumes/creates the sandbox
   and OpenCode session recorded for that app.
4. Changes are committed to the app's git home; the app history records the
   revision associated with agent runs and deployments.
5. Destroying a sandbox stops/deletes execution capacity only. It retains the
   App record, git source, conversation/run history and deployment history so
   the app can be resumed or rebuilt.

### Completion criteria for this layer

- An organisation with two Kitchens renders the two-level dashboard without
  treating the organisation as a place to create apps.
- A Chef sees only their Kitchen(s), then only the apps in those Kitchens.
- Creating/opening an app creates/uses a durable App record and a durable git
  home before the sandbox is used.
- Destroying an app's sandbox leaves its source and history available, and
  reopening the app can provision a fresh sandbox from that source.
- The existing live workspace no longer treats a query-string project ID as
  the app-selection mechanism.

## 3. Secrets

### Goal

Let a Head Chef provide shared Kitchen configuration, and let a Chef supply an
App-specific credential when the agent needs one. Keep the first version close
to ordinary environment-variable practice: a secret has a name, and the
code/agent refers to the name rather than handling its value in chat.

### Scopes and ownership

There are exactly two scopes:

| Scope | Created and managed by | Intended use |
|---|---|---|
| **Kitchen secret** | Head Chef (or organisation owner) | A named value shared with every App in that Kitchen: e.g. Cloudflare deployment access or a shared analytics key. |
| **App secret** | Head Chef or an eligible Chef working on that App | A named value for one App only: e.g. `GOOGLE_MAPS_API_KEY`. |

Kitchen secrets are automatically available to the Apps in their Kitchen. App
secrets are automatically available only to their own App. An App secret with
the same name takes precedence over a Kitchen secret; the UI warns when that
happens. We do not add per-App secret bindings, separate permitted uses, or a
generic secret policy editor in this first version.

### Variable-reference model

When a secret is saved, its **name** is its stable variable reference. For
example, a Chef can save an App secret called `GOOGLE_MAPS_API_KEY`; the agent
is told that `GOOGLE_MAPS_API_KEY` is available for this App and writes code
that reads `process.env.GOOGLE_MAPS_API_KEY` (or the language-equivalent
environment-variable reference). The secret value is never placed in the
prompt, conversation or source code.

The Kitchen configuration page shows the names and metadata of Kitchen
secrets. The App configuration page shows:

- its own App-secret names and metadata;
- the Kitchen-secret names it inherits; and
- any name collision/override.

Secret values are entered through a write-only form. After saving, nobody —
including the creator — can read the value back through the platform; they can
replace it (rotate it) or delete it. Secret metadata and activity history never
include a value or partial value.

### Storage and execution boundary

Secret plaintext is encrypted at rest in the control plane. The encryption-key
boundary/provider is an implementation decision still to make; it must be
separate from the application database and support rotation. The application
decrypts a value only after server-side membership checks, for the operation
for which it is needed.

For an agent run, deploy or App runtime, the platform supplies the effective
Kitchen and App secrets as process environment variables (or a
provider-required credential file). It must not put them in OpenCode prompt
text, SSE payloads, URLs, local storage, browser logs, the organisation git
repository or long-lived sandbox metadata. The process environment is cleared
when the operation ends; a destroyed sandbox has no retained secret material.

There is an important boundary to state plainly: an agent process that is
given a secret can read it. The platform cannot both give an arbitrary coding
agent an environment variable and cryptographically hide its value from that
agent. The first version relies on trusted members of a Kitchen and ordinary
environment-variable practice; tighter capabilities can come later.

### Leakage protection

- Redact configured secret values from application, sandbox and deployment log
  capture before it is stored or displayed. Redaction reduces accidental
  disclosure; it is not a substitute for narrow privileges.
- Prevent commits containing a configured secret value to the organisation
  repository, using a pre-commit/CI secret scan before the platform records a
  successful revision or deployment.
- Do not include environment dumps in normal agent, audit or preview output.
- Deleting/rotating a secret changes it for new runs, deploys and runtime
  starts. It cannot retract a value already observed by a previous run, so
  rotation is the response when exposure is suspected.

### Initial migration

The current Cloudflare credentials held by the application runtime are a
bootstrap exception. Once this layer exists, create them as a Kitchen secret,
remove the shared deploy path, and make them available to the Kitchen's Apps.
App-specific credentials such as Google Maps are saved as App secrets instead
of being pasted into a conversation.

### Completion criteria for this layer

- A Head Chef can create a Kitchen secret without exposing its value in the
  browser.
- A Kitchen secret is available by name to every App in that Kitchen, and an
  App secret is available by name only to its App.
- A Chef can create/rotate an App secret only for an App in their Kitchen.
- The agent can use an App secret by referring to its environment-variable
  name, without ever receiving the value in the chat interface.
- Secret values are absent from durable chat/audit records and blocked from the
  organisation repository by the platform's secret scan.

---

## Earlier draft: proposed roles, secrets and deploy-approval model (not yet reconciled)

The sections below were drafted on `codex/wrapping-spec` before the multi-user
access slice above was implemented. They propose a broader role, secrets/integration
and deployment-approval model. Kept here for reference; needs reconciling with the
implemented Better Auth / org-Kitchen-app model above rather than treated as current plan.

## Purpose of the wrapper

The wrapper is the product layer around the OpenCode-in-Daytona core. It is the
place where an organisation decides who may use the platform, what they may
build and deploy, which integrations and secrets are available, and how work
can be observed or approved. It must not become a second agent backend: the
browser continues to speak only to our application, and our application
continues to proxy the project agent running in its sandbox.

The first version should make the existing real end-to-end flow feel like a
safe, understandable product for a small internal team. Multi-tenant scale,
enterprise identity provisioning and every possible provider can follow once
the model below is working.

## Current core and wrapper seam

The real core currently has two useful but intentionally pre-wrapper paths:

- `/live?project=<id>` provisions or resumes an OpenCode server in a Daytona
  sandbox labelled by that project ID, and exposes its conversation, preview
  and sandbox-destruction controls through same-origin application routes.
- The counter proof deploys from a Daytona sandbox using Cloudflare credentials
  held by the application runtime. It proves the deploy/destroy mechanics, but
  is deliberately a single shared internal setup rather than a credential
  boundary.

Those paths are the implementation seam, not a security model. The wrapper
must replace browser-supplied project selection with a server-resolved project
record and an effective membership check before **every** sandbox, session,
preview, deployment or deletion operation. It must replace shared runtime
credentials with a scoped secret/integration capability selected from the
project's effective Kitchen policy. The existing sandbox label and OpenCode
session identifier become implementation details stored against the Project;
they are not authority-bearing identifiers.

## Core vocabulary and boundaries

- **Organisation**: the top-level customer/account boundary, including its
  identity configuration, billing ownership and audit retention.
- **Kitchen**: a scoped working environment inside an organisation. A Kitchen
  carries default policy, integrations, skills/agent instructions and
  observability settings. Kitchens may be nested, with child Kitchens only
  able to make policy more restrictive than their parent.
- **Chef**: a human member. A Chef's effective access is the intersection of
  their role and every applicable Kitchen policy.
- **Project**: a specific application or coding effort within a Kitchen. It
  owns its source repository/branch, sandbox, OpenCode sessions, deployments
  and project-specific secrets.
- **Run**: one attributable agent interaction or deployment operation. Runs
  supply the audit trail and approval history; conversation messages remain
  available in the project timeline.

The product control plane stores this metadata, access decisions, encrypted
secret references and audit events. The execution plane is the Daytona sandbox
and the deployed application. A sandbox receives only the short-lived,
least-privileged material needed for its current task.

## Dashboard

The landing page after sign-in is an organisation dashboard. It should answer
three questions immediately: what needs my attention, what is currently
running, and where do I resume work.

### Head Chef dashboard

- **Attention queue**: deployment approvals, access requests, proposed Kitchen
  policy changes, failed runs and expiring/invalid integrations.
- **Kitchen overview**: each Kitchen's member count, active projects, active
  sandboxes, recent deployment status and current policy posture.
- **Project activity**: recently changed projects, agent runs in progress,
  deployment history and links to the conversation/preview.
- **Risk and cost signals**: sandbox usage, failed deployment rate, secrets
  requiring rotation and policy exceptions. These are signals, not a billing
  system in the first release.

### Chef dashboard

- Projects the Chef can open, ordered by recent activity.
- A clear **Create project** action, pre-filled with the Kitchen's approved
  template and defaults.
- Their pending invitations, access requests and approvals they have requested.
- A compact activity feed for their own projects, including when a Head Chef
  approves, rejects or comments on a deployment.

The project page remains the coding workspace. Its header should always show
the current Kitchen, environment, deployment state, effective permissions and
whether the agent is currently running. Controls that are unavailable by
policy should be shown disabled with a concise explanation rather than hidden.

## Membership, invitations and roles

Initial authentication can be passwordless email sign-in. An invitation grants
access to a named organisation and Kitchen only after the recipient verifies
control of its target email address. Invitations are single-use, expire after a
short configurable period, and can be revoked before acceptance. We should
not create an active member record until acceptance.

The first role set should be deliberately small:

| Role | Intended capabilities |
|---|---|
| Organisation owner | Manage the organisation, its owners, identity settings, billing and all Kitchens. Keep this role rare. |
| Head Chef | Manage an assigned Kitchen: members, projects, defaults, integrations and approvals, within inherited parent policy. |
| Chef | Create and work on permitted projects; use approved secrets and integrations; request deployments or elevated access. |
| Viewer | Inspect allowed projects, conversations, runs and deployments; cannot prompt an agent, change code or expose secrets. |

Roles establish the upper bound, then per-Kitchen permissions refine it. The
first permissions worth making explicit are `view_projects`, `create_projects`,
`run_agent`, `manage_project_secrets`, `request_deploy`, `approve_deploy`,
`deploy`, `manage_members` and `manage_kitchen_policy`. Avoid arbitrary
per-action ACLs until a real need appears; role plus these named grants are
auditable and understandable.

Parent Kitchens can grant a child Kitchen a bounded delegation (for example,
"may invite people from @example.com and may deploy only to staging"). Children
cannot widen an inherited domain restriction, secret scope, deployment target
or approval requirement.

## Kitchen setup and policy

Creating a Kitchen is a short, explicit setup flow:

1. Name it and select its parent (if any).
2. Choose an approved project template and source-control destination.
3. Select its sandbox profile: base image, allowed network destinations,
   compute limits, idle shutdown and permitted tools/skills.
4. Attach approved integrations and secret scopes.
5. Set deployment environments and approval rules.
6. Set observability defaults and invite the initial Chefs.

Kitchen policy is versioned. A Head Chef proposes a change as a diff with a
plain-language impact summary; if the parent policy or Kitchen rule requires
approval, the change remains pending until approved. Every project run records
the policy version it used, so later investigation does not rely on today's
configuration.

Useful first policy controls are:

- permitted model/provider configuration and maximum spend/run;
- sandbox image, resource limits, idle destruction and outbound-domain allowlist;
- repository template and branch/deployment naming convention;
- which integrations and secret scopes a project may request;
- staging/production targets and who may request versus approve/deploy;
- required agent instructions, skills, testing and observability defaults.

## Secrets and integrations

Secrets need a dedicated management area; they must never be passed through
the chat transcript, browser logs or durable audit-event payloads. A secret is
an encrypted value stored by the control plane plus metadata: owner scope,
provider/type, allowed projects/environments, creation and last-rotated times,
and who may use or rotate it. The UI may reveal neither the original value nor
an equivalent recovery mechanism after creation.

Start with three scopes:

- **Organisation secrets**, available only where a Kitchen policy delegates
  them (for example, central observability credentials).
- **Kitchen secrets**, such as a shared Cloudflare account or an approved
  model-provider credential.
- **Project secrets**, such as the Google Maps credential supplied for one app.

Projects reference a named secret capability rather than receive a raw value
in configuration. At run time the application checks the effective policy,
then injects a short-lived value into the sandbox process environment or a
provider-specific credential file. The agent should be told a capability is
available (for example, `GOOGLE_MAPS_API_KEY`) but the platform should redact
its value from agent output wherever possible. A sandbox must not retain
secrets after destruction, and preview/deployment logs must be redacted before
they reach the UI.

Integrations are related but distinct. An integration records how the platform
connects to GitHub, Cloudflare, Daytona, PostHog, Sentry or an identity
provider; it stores OAuth/token material and account metadata behind the same
encryption boundary. Kitchen policy grants projects a narrow capability such as
"deploy to this Cloudflare account's staging environment", rather than giving
them a general-purpose Cloudflare API token.

The first release needs create, rotate, revoke and scope-change actions,
confirmation before destructive revocation, and immutable audit events for
each. Automatic rotation, secret scanning and customer-managed keys are later
work, though the data model should leave room for them.

## Deployment and approval flow

Each project has named environments: at minimum `preview`/`staging` and
`production`. A Chef can run the agent and deploy to environments permitted by
their Kitchen. For protected environments, a deploy action creates a
deployment request containing the source revision, changed files, test result
summary, target, requested secrets/integrations and the policy version.

An eligible Head Chef approves or rejects the request with an optional comment.
Approval is for an immutable revision and expires if the revision, target,
effective secret scope or policy changes. The actual deployment then runs with
a short-lived deployment credential and records its provider URL, status and
logs. A production deploy must never be silently retried after a failure.

For the first increment, implement one protected toggle: **"Chef may deploy
only with Head Chef approval."** It corresponds directly to the existing demo
journey and establishes the approval/audit model before adding richer rules.

## Observability and audit

The wrapper should expose a project activity timeline combining agent runs,
approvals, deployments, sandbox lifecycle changes and policy/secret metadata
events. It should link out to configured PostHog, Sentry and OpenTelemetry
destinations rather than reimplement those products.

Audit events are append-only and include actor, action, resource, timestamp,
effective role/policy version and outcome. They deliberately exclude secret
values, full unredacted environment variables and sensitive prompt attachments.
Organisation owners can search and export audit events; Viewers may see only
events for resources they can already access.

## First delivery slices

Build the wrapper in vertical slices around the real core rather than by
building every administration screen first:

1. **Single Kitchen, seeded owner**: add persisted organisation, Kitchen,
   project and membership records; route the existing live workspace through a
   server-authorised selected project rather than `demo-project` or a
   browser-trusted query parameter. Persist the sandbox label and OpenCode
   session identifiers only as project metadata.
2. **Project dashboard**: list/create/resume projects; show sandbox and
   deployment state, and retain the existing destroy action behind project
   ownership.
3. **Invitations and roles**: email invitation acceptance, Kitchen-scoped Chef
   and Viewer roles, plus server-side permission checks on every project route.
4. **Kitchen/project secrets**: encrypted storage, scoped injection and
   redaction, initially for Daytona, Cloudflare and Google Maps credentials;
   migrate the counter proof away from application-wide Cloudflare credentials.
5. **Protected deployment**: request/approve/reject flow for production and a
   durable audit timeline.
6. **Nested Kitchens and enterprise identity**: parent-policy inheritance,
   domain gating, SSO/OAuth and broader integrations only after the simple
   model has been exercised.

Every slice needs server-side authorisation; client-side disabled buttons are
explanatory UI only, never enforcement. The wrapper should be introduced
without breaking the direct core workflow: existing projects get migrated into
a seeded Kitchen, and their active sandbox/session identifiers remain attached
to the new project record.

## Decisions to validate before implementation

- Which identity provider should power the first invitation/sign-in flow, and
  what data-residency requirements apply?
- Where will encrypted secrets live, which KMS/key-management boundary is
  acceptable, and who is allowed to perform an emergency break-glass rotation?
- Is GitHub access an organisation-wide installation, per-Kitchen connection,
  or initially one internal service account?
- What is the exact approval policy for production: one Head Chef, any two
  approvers, or a named code owner for the project?
- Which audit retention period and export controls are needed for the intended
  internal users?
