import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAppAccess } from '$lib/server/authz';

// Deployment previously ran Wrangler with a Cloudflare token inside the
// agent-controlled workspace. Repository configuration, dependencies and
// commands can read or redirect that token, even when it is marked hidden
// from the agent. Stop before resolving credentials or starting a sandbox.
// A trusted deployment pipeline must be implemented before restoring this.
const unavailable = {
	success: false,
	log: 'Deployment and undeployment are temporarily disabled: the previous flow exposed Cloudflare credentials to project code. Use a trusted external CI/CD deployment for now; your existing deployments and data have not been changed.'
};

export const POST: RequestHandler = async (event) => {
	await requireAppAccess(event);
	return json(unavailable, { status: 503 });
};

export const DELETE: RequestHandler = async (event) => {
	await requireAppAccess(event);
	return json(unavailable, { status: 503 });
};
