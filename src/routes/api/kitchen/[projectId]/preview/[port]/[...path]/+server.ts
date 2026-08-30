import type { RequestHandler } from './$types';
import { getSandboxProvider } from '$lib/server/opencode/sandbox';

// Proxies an arbitrary port inside a project's sandbox (e.g. a dev server the
// agent started) same-origin, the same way the opencode SSE stream is proxied.
// Known limitation (matches the open question in docs/03_opencode_backend_spec.md):
// this doesn't rewrite HTML/asset URLs, so a dev server that emits root-absolute
// asset paths (most do by default) will 404 through this prefix unless it's
// configured with a matching base path. Good enough for a same-page app or a
// dev server already configured for a base path; a real reverse-proxy rewriter
// is future work.
const proxy: RequestHandler = async ({ params, url, request, fetch }) => {
	const port = Number(params.port);
	if (!Number.isInteger(port) || port <= 0) {
		return new Response('invalid port', { status: 400 });
	}

	const target = await getSandboxProvider().getPreviewUrl(params.projectId, port);
	const upstreamUrl = new URL(`${target.url}/${params.path ?? ''}${url.search}`);

	const upstream = await fetch(upstreamUrl, {
		method: request.method,
		headers: { ...target.headers },
		body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
		redirect: 'manual'
	});

	return new Response(upstream.body, {
		status: upstream.status,
		headers: upstream.headers
	});
};

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const PATCH = proxy;
