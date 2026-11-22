import { cloudflareAgentTarget, cloudflarePreviewTarget, type CloudflarePortBridge } from './cloudflare-transport.ts';

/** Binding-only RPC exposed by one app's sandbox Durable Object. */
export interface CloudflareProjectBridge extends CloudflarePortBridge {
	isRunning(): Promise<boolean>;
}

export interface CloudflareProjectNamespace {
	getByName(name: string): CloudflareProjectBridge;
}

/**
 * Return the binding for exactly one app. The caller must resolve and authorize
 * the app before calling this function. IDs are canonical UUIDs stored in D1;
 * accepting arbitrary names here would permit colliding project namespaces.
 * Creating this handle does not start the container.
 */
export function cloudflareProject(namespace: CloudflareProjectNamespace, appId: string) {
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appId)) {
		throw new Error('Invalid app ID');
	}
	const id = appId.toLowerCase();
	const bridge = namespace.getByName(`app:${id}`);
	return {
		isRunning: () => bridge.isRunning(),
		agent: () => cloudflareAgentTarget(id, bridge),
		preview: (port: number) => cloudflarePreviewTarget(bridge, port)
	};
}
