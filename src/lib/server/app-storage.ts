export type CloudflareCredentials = {
	CLOUDFLARE_API_TOKEN: string;
	CLOUDFLARE_ACCOUNT_ID: string;
};

export type AppStorage = { databaseId: string; databaseName: string };
type RemoteD1Database = { uuid?: string; name?: string };

function toAppStorage(database: RemoteD1Database): AppStorage {
	if (!database.uuid || !database.name) throw new Error('Cloudflare returned an incomplete D1 database record.');
	return { databaseId: database.uuid, databaseName: database.name };
}

export async function getAppStorage(db: D1Database, appId: string): Promise<AppStorage | null> {
	return db
		.prepare('SELECT database_id AS databaseId, database_name AS databaseName FROM app_storage WHERE app_id = ?')
		.bind(appId)
		.first<AppStorage>();
}

type CloudflareResponse<T> = { success: boolean; result?: T; errors?: Array<{ message?: string }> };

function apiUrl(creds: CloudflareCredentials, path: string) {
	return `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(creds.CLOUDFLARE_ACCOUNT_ID)}${path}`;
}

async function cloudflare<T>(creds: CloudflareCredentials, path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(apiUrl(creds, path), {
		...init,
		headers: { Authorization: `Bearer ${creds.CLOUDFLARE_API_TOKEN}`, ...init?.headers }
	});
	const body = (await response.json()) as CloudflareResponse<T>;
	if (!response.ok || !body.success || body.result === undefined) {
		throw new Error(body.errors?.[0]?.message ?? `Cloudflare D1 request failed (${response.status}).`);
	}
	return body.result;
}

/**
 * Creates at most one D1 database for an App. The row is the durable source of
 * truth, so sandbox recreation never creates a second database.
 */
export async function getOrCreateAppStorage(
	db: D1Database,
	appId: string,
	creds: CloudflareCredentials
): Promise<AppStorage> {
	const existing = await getAppStorage(db, appId);
	if (existing) return existing;

	const databaseName = `vibe-app-${appId}`;
	const created = await cloudflare<RemoteD1Database>(creds, '/d1/database', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name: databaseName })
	});
	const { databaseId } = toAppStorage(created);

	const storage = { databaseId, databaseName };
	// A competing first deploy can create an unused Cloudflare database, but it
	// cannot replace the App's recorded database or cross an App boundary.
	await db
		.prepare(
			`INSERT INTO app_storage (app_id, database_id, database_name, created_at)
			 VALUES (?, ?, ?, ?) ON CONFLICT(app_id) DO NOTHING`
		)
		.bind(appId, databaseId, databaseName, new Date().toISOString())
		.run();
	return (
		(await getAppStorage(db, appId)) ?? storage
	);
}

export async function listOrphanedAppStorage(db: D1Database, creds: CloudflareCredentials) {
	const [databases, linked] = await Promise.all([
		cloudflare<RemoteD1Database[]>(creds, '/d1/database?per_page=100'),
		db.prepare('SELECT database_id AS databaseId FROM app_storage').all<{ databaseId: string }>()
	]);
	const linkedIds = new Set(linked.results.map((row) => row.databaseId));
	return databases.map(toAppStorage).filter((database) => database.databaseName.startsWith('vibe-app-') && !linkedIds.has(database.databaseId));
}

export async function unlinkAppStorage(db: D1Database, appId: string, expectedName: string) {
	const storage = await getAppStorage(db, appId);
	if (!storage || storage.databaseName !== expectedName) throw new Error('Storage confirmation does not match the linked database.');
	await db.prepare('DELETE FROM app_storage WHERE app_id = ?').bind(appId).run();
}

export async function relinkAppStorage(
	db: D1Database,
	appId: string,
	databaseId: string,
	creds: CloudflareCredentials
) {
	if (await getAppStorage(db, appId)) throw new Error('Unlink the current database before relinking another one.');
	const database = toAppStorage(await cloudflare<RemoteD1Database>(creds, `/d1/database/${encodeURIComponent(databaseId)}`));
	if (!database.databaseName.startsWith('vibe-app-')) throw new Error('Only a Vibe app database can be relinked.');
	const linked = await db.prepare('SELECT app_id FROM app_storage WHERE database_id = ?').bind(databaseId).first();
	if (linked) throw new Error('That database is already linked to an App.');
	await db
		.prepare('INSERT INTO app_storage (app_id, database_id, database_name, created_at) VALUES (?, ?, ?, ?)')
		.bind(appId, database.databaseId, database.databaseName, new Date().toISOString())
		.run();
	return database;
}

export async function destroyAppStorage(db: D1Database, appId: string, expectedName: string, creds: CloudflareCredentials) {
	const storage = await getAppStorage(db, appId);
	if (!storage || expectedName !== `DELETE ${storage.databaseName}`) {
		throw new Error('Type the exact permanent-delete confirmation to continue.');
	}
	await cloudflare<null>(creds, `/d1/database/${encodeURIComponent(storage.databaseId)}`, { method: 'DELETE' });
	await db.prepare('DELETE FROM app_storage WHERE app_id = ?').bind(appId).run();
}
