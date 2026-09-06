// Persists an App's source outside its disposable sandbox, using Cloudflare
// R2 alone (see AGENTS.md's wrapper step 3 — this is the Cloudflare-only
// alternative to "a durable branch in the organisation repository"). One R2
// object per App: a gzip tarball of its project directory (see
// SOURCE_EXPORT_EXCLUDES in opencode/sandbox.ts for what's left out).

function sourceKey(appId: string) {
	return `apps/${appId}/source.tar.gz`;
}

export async function saveAppSource(
	bucket: R2Bucket,
	appId: string,
	provider: { exportSource(id: string): Promise<Uint8Array> }
): Promise<{ byteLength: number }> {
	const bytes = await provider.exportSource(appId);
	await bucket.put(sourceKey(appId), bytes);
	return { byteLength: bytes.byteLength };
}

/** Returns null if this App has never been saved. */
export async function loadAppSource(bucket: R2Bucket, appId: string): Promise<Uint8Array | null> {
	const object = await bucket.get(sourceKey(appId));
	if (!object) return null;
	return new Uint8Array(await object.arrayBuffer());
}

export async function hasAppSource(bucket: R2Bucket, appId: string): Promise<boolean> {
	const head = await bucket.head(sourceKey(appId));
	return head !== null;
}

export async function deleteAppSource(bucket: R2Bucket, appId: string): Promise<void> {
	await bucket.delete(sourceKey(appId));
}
