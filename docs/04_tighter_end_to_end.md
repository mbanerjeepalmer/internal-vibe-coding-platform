# Internal vibe coding platform

Right, the situation at 15:24 is that we have verified, across different branches, that:
1. a Daytona sandbox can create and destroy Cloudflare workers and persistent storage, and
2. OpenCode running inside a Daytona sandbox can connect to our custom web UI running on a Cloudflare worker.

Now to connect the two. This will be a subset of `02_real_spec.md` and the other specs. We simply need to have an application that gives you an OpenCode conversation, that can write some code and then it can be deployed to Cloudflare. There are a lot of other considerations, listed elsewhere in the docs. But for now let's get this one core flow working in prod.
