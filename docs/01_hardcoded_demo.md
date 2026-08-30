# Internal Vibe Coding Platform

## v0.1 Hardcoded demo journey
We are building an internal vibe coding platform.

We'll try to build it to be platform-agnostic. But here's the journey we'll want to see:
- Email 'Maurice has invited you to his vibe coding platform' --> accept invitation
- Goes to `https://maurices-non-technical-friends.vibe.kitchen` and log in as 'Alexandra'.
- We see a Codex/Claude Code style interface.
- Example: We give it a video of some voice notes being played on WhatsApp. This is a spec for a Google Maps alternative.
- Behind the scenes, this goes to OpenAI Codex SDK, running inside a Daytona sandbox.
  - Open question: how do we handle code version control? I'm thinking one branch per project perhaps with a naming convention to indicate staging/prod per-project. (Alternative is a a monorepo or maybe an organisation.)
- The agent asks two sensible clarifying questions and then goes and builds the web application.
  - It asks for Google Maps API creds, which we paste in.
  - We can see that it's done Red/Green TDD and pyramid testing using Playwright. It asks if we want to deploy to Cloudflare.
- We test it out within another pane (which works well on mobile) and a dev server URL. We give a bit more feedback to add an emoji feature.
- We use the 'Deploy to Cloudflare' button. We visit the application at `https://maps-alternative.vibe.kitchen`, for some reason it crashes. (Maybe because it's on the Cloudflare worker a certain type of dependency breaks?)
- We go back to the vibe coding platform. We follow the links out to PostHog and Sentry. Within the project, we fix the problem.
  - Open question: I'm not sure how the integrations back from those platforms into the Codex in Daytona works.
- A lot of the above, the Red/Green TDD and PostHog, for example, seems to have come for free. We see in the parent config that this is because Maurice has already configured all of this for the 'Kitchen' called 'Maurice's non-technical friends'.
  - Open question: how does this configuration work? Some of it should clearly be agent skills (e.g. asking clarifying questions and following Red/Green TDD). Some of it should be part of the container (in this case Daytona) configuration.
- We propose a change to the parent config, to avoid the same type of crash as we already had.
- Now we 'log out, then log in' as Maurice.
- We see that Alexandra is just one of many 'chefs' that I've invited to my 'kitchen'. And in fact, Claudia is the chef above both of us. I can see Alexandra's project and conversation history. I can also see the change that she's proposed to my config. I go to change her permissions so that she can only deploy with my approval.


## Tech notes
- Build this hardcoded demo of the end-to-end flow as a SvelteKit project, using Tailwind.
- Red/Green TDD and pyramid testing with Playwright.
- Implement this using a worktree -- I want to be able to continue editing the main repo.
- Deploy to Cloudflare -- I'll need to give you some creds for Wrangler.

## Coding agent notes
<!--Communicate here with a timestamp at the start of the line and a terse note afterwards. Note you may be working in a worktree so would need to refer back to the home.-->
2026-08-30: Deploy-first plan agreed (bare SvelteKit -> Cloudflare -> configure domain, before building the full hardcoded journey). Worktree created at ../ivcp-deploy-bootstrap on branch deploy-bootstrap (home repo: internal-vibe-coding-platform, main branch). Scaffolded a minimal SvelteKit + TS project via `npx sv create` (default template, no add-ons yet) directly into the worktree root. Staged but NOT yet committed. Next steps: add Tailwind (`npx sv add tailwindcss`), add `@sveltejs/adapter-cloudflare` + wrangler config, deploy to Cloudflare, then configure the custom domain.
2026-08-30: Committed the bare scaffold. Added Tailwind v4 (`npx sv add tailwindcss`), switched the adapter from `adapter-auto` to `@sveltejs/adapter-cloudflare` in `vite.config.ts`, added `wrangler.jsonc` (worker name `ivcp-hardcoded-demo`, assets binding, `main: .svelte-kit/cloudflare/_worker.js`), and generated `worker-configuration.d.ts` via `npx wrangler types` (committed for editor support). `npm run check` and `npm run build` both pass. Blocked on deploy: `npx wrangler whoami` shows not logged in and the environment is non-interactive, so I need Cloudflare credentials (API token, or run `wrangler login` interactively) before `wrangler deploy` can run.
2026-08-30: User ran `wrangler login` interactively; auth confirmed via `wrangler whoami`. Ran `npx wrangler deploy` — succeeded. Live at https://ivcp-hardcoded-demo.mbanerjeepalmer-cloudflare.workers.dev (200 OK, verified with curl). Next step: configure the custom domain (`*.vibe.kitchen` per the spec) once DNS/zone details are available, then start building the hardcoded demo journey itself.
