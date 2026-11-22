import type { PreviewTarget, Sandbox } from './sandbox';

/** The RPC surface a project-specific Durable Object must provide. */
export interface CloudflarePortBridge {
	proxy(port: number, request: Request): Promise<Response>;
}

// There is no externally routable hostname here. Every request is dispatched
// through the binding. App authorization belongs to the caller before it gets
// the project-specific stub; a project ID alone must never grant access.
export function cloudflareAgentTarget(projectId: string, bridge: CloudflarePortBridge): Sandbox {
	return {
		projectId,
		baseUrl: 'http://sandbox.internal',
		fetch: (request) => bridge.proxy(4096, request)
	};
}

export function cloudflarePreviewTarget(bridge: CloudflarePortBridge, port: number): PreviewTarget {
	if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid preview port');
	return {
		url: 'http://sandbox.internal',
		fetch: (request) => bridge.proxy(port, request)
	};
}
