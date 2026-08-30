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
2026-08-30: User asked to get the hardcoded demo working locally before the custom domain. Planned + built the full v0.1 journey as static/lightly-interactive SvelteKit routes (no real backend, no cross-route state — each route is a hardcoded snapshot of one story beat): `/` (invite email) -> `/login` (persona via `?as=`) -> `/chat` (Alexandra's build session: attach spec, clarifying Qs, API key, TDD+Playwright pyramid output, preview pane with mobile toggle, emoji feedback, deploy button) -> `/deployed` (simulated crash) -> `/fix` (PostHog/Sentry link-outs, fix transcript, redeploy) -> `/config` (Kitchen config + Alexandra's proposed diff) -> `/login?as=maurice` -> `/dashboard` (chef list: Claudia above Maurice, Alexandra invited) -> `/dashboard/alexandra` (her project, conversation links, approve/reject the proposed change, "require approval before deploy" permission toggle). Shared components in `src/lib/components/` (TopBar, BrowserChrome, ChatMessage), hardcoded content in `src/lib/data/`. Added `@playwright/test` with one end-to-end test (`tests/journey.spec.ts`) walking the whole path — deliberately the only test layer, since there's no real logic yet for unit/integration tests to check. Needed `--no-sandbox` in `playwright.config.ts` launchOptions for Chromium to run in this sandboxed dev environment. `npm run check`, `npm run build`, and `npx playwright test` all pass; manually curl-verified every route returns 200 via `npm run dev`. Custom domain and redeploying this version to Cloudflare are still pending (user wanted local-first).
