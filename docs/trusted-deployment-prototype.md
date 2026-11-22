# Trusted deployment prototype

The deployment endpoint is deliberately disabled: running Wrangler in an agent-controlled workspace gives project code access to the Cloudflare API token. The prototype in `src/lib/server/trusted-worker-upload.ts` demonstrates a different boundary: a control-plane process uploads an already-built, single ES module directly through Cloudflare's Workers API. The sandbox receives no deployment credentials. It only targets a separate `vibe-prototype-<app UUID>` Worker name, uses fixed metadata, and does not accept project-controlled Worker names or Wrangler configuration.

This module is available through the separate authenticated `POST /api/kitchen/{appId}/prototype-deploy` endpoint, with a JSON body containing `moduleSource`. It accepts a single already-built ES module of at most 1 MB and uploads it to a separate prototype Worker; it does not build the project or set up bindings, assets, migrations, or a public URL. The regular deployment endpoint remains disabled. This endpoint **has not been tested against a live Cloudflare account**. Calling it makes a real Cloudflare API request and may create or replace the app’s prototype Worker. The two mock tests can be run with `node --test tests/unit/trusted-worker-upload.test.mjs` on Node 24. A successful mock does not verify Cloudflare account behavior.

Before enabling a product deployment path:

1. Authenticate and authorize the app and deployment target in the control plane; establish project ownership and avoid overwriting existing Workers.
2. Build and collect a bounded artifact in an isolated, credential-free environment, then validate it and transfer it to the uploader. Treat build output and metadata as untrusted.
3. Support multi-file modules, static assets, D1 bindings, migrations, app secrets, routes, version history and meaningful URLs without accepting arbitrary account resources or exposing broad deployment credentials to project code. Maintain data and existing bindings explicitly. Avoid claiming atomicity across migration and upload.
4. Use narrowly scoped Cloudflare credentials, audit events without secret values, and test failures, cancellation, retries and authorization across apps.
5. Run end-to-end tests in a dedicated Cloudflare test account against non-production resources. Confirm cleanup, bindings, rollback and quotas before connecting the UI.

For now use a separately managed trusted CI/CD workflow to deploy. Do not enable the old sandbox-based deployment methods: hiding an environment variable from the agent does not protect it when the deployment process runs attacker-controlled code.
