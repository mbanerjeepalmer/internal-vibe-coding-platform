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
