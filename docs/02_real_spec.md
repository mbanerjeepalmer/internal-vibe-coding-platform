# Internal Vibe Coding Platform

In the `01_hardcoded_demo.md` we've described a high-level journey for a personal use case. We want to take this to the point where it can be a fully-featured enterprise-grade internal vibe coding platform.

In this document we need to flesh out the full set of requirements and the phasing of their implementation.

## A complete internal vibe coding platform

This means:
- Secrets management:
  - Needs cascade management.
  - Overlaps with observability, since you want to monitor usage of things like API calls.
  - May also need provisioning.
- Specifications:
  - Combination of conversation history and persistent files in the repo.
- Deployment
- Code hosting and version control
- Agent-user interface:
  - We always need an agent. It can be different across cases, but it should be something like Codex, Claude, OpenCode or Pi.
  - Users need to be able to control the agent.
- Environment:
  - We prefer Daytona for this demo.
  - But ultimately it should be possible to configure any environment (e.g. VPS, Docker, local).
- Tools/utilities:
  - We should be able to configure the project so that it comes preloaded with skills/`AGENT.md` (and we want to be able to hook them in at the right points).
- Persistent storage:
  - Members (Chefs) should be able to set up databases and blob storage.
- Observability and analytics:
  - Kitchen owners (Head Chefs) can configure defaults such as OpenTelemetry and web analytics.
- Access control:
  - Hierarchy: a kitchen within a kitchen is allowed.
  - Owner/write/read permissions: each kitchen has a head chef and then each chef gets granular permissions.
  - Should have domain gating and hierarchy.
  - Ideally eventually gets OAuth through Entra/Google etc.

## A feasible working demo
But let's go back to what's demoable now. The specific app that our invited user wants to build is one that:
- Can pull from their existing, real Google Maps to back up all of their saved places.
- They want to be able to tag saved places with a defined number of tags.
- They want an ~unlimited number of saved places.
- They want to be able to share their map with friends.
- Places details should still pull from Google Maps and the buttons should deeplink back out to it, for directions, for example.

### Tech specs
Let's not do login org structure or anything like that at this stage. Just the proof that we can do all the coding steps. Note that means we _do_ need real Daytona, GitHub and Cloudflare integrations.
- Authed user: We don't need multi-user at this point. Just me. And all the steps are hardcoded so we don't need to worry too much about abuse.
- GitHub: each application in a Kitchen is a branch in a private repo for the authed user.
- Cloudflare: We'll deploy the app and its DB here.
- Daytona: A config that gives the 'agent' all of the tools to build (e.g. skills, MCP), connections/deployment (e.g. Cloudflare worker and DB) and secrets (i.e. pre-existing such as Cloudflare or to-be-created such as Google Maps). Once we go multi-user, this config is managed by the Head Chef.
- Agent: We'll use OpenCode as the backend that runs on Daytona and our custom UI to display its responses.

### v0.2 Hardcoded but real

Let's build this app for real, but hardcode all of the exact steps (i.e. 'agent' is sending messages as if it's building but in reality it's following a pre-written set of steps). We'll run them in a Daytona sandbox and deploy to Cloudflare for real.

In the Kitchen platform UI we should be able to hard delete this app afterwards so that we can do it again.

#### v0.2.1 Counter
I think you should first just write a counter app as a proof of concept of the end-to-end flow.

We're still working out the OpenCode aspect, so you can even just build with two buttons: one for build and deploy, one for destroy.

#### v0.2.2 Google Maps alternative
Then come back to me about the Maps alternative.
