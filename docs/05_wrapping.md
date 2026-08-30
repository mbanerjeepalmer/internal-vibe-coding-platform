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
