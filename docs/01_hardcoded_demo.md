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


## Tech notes
- Build this parent as a SvelteKit project, using Tailwind.
- Red/Green TDD and pyramid testing with Playwright.
