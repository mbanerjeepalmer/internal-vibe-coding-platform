import { error } from '@sveltejs/kit';
import { getAppAccess } from './control-plane';

export type SecretScope = 'kitchen' | 'app';
export type SecretMetadata = {
	id: string;
	name: string;
	scope: SecretScope;
	createdAt: string;
	updatedAt: string;
	overridesKitchenSecret?: boolean;
};

const namePattern = /^[A-Z][A-Z0-9_]{0,127}$/;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function requireKey(key: string | undefined) {
	if (!key) throw error(503, 'Secret management is not configured. Set SECRET_ENCRYPTION_KEY on the Worker.');
	return key;
}

async function encryptionKey(material: string) {
	const digest = await crypto.subtle.digest('SHA-256', encoder.encode(material));
	return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

function encode(bytes: ArrayBuffer | ArrayBufferView) {
	const raw = bytes instanceof ArrayBuffer
		? new Uint8Array(bytes)
		: new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	return btoa(String.fromCharCode(...raw));
}

function decode(value: string) {
	return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function encrypt(value: string, keyMaterial: string) {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(keyMaterial), encoder.encode(value));
	return { ciphertext: encode(ciphertext), iv: encode(iv) };
}

/** Values only cross this boundary for an authorised operation; metadata is always value-free. */
export async function effectiveAppSecrets(db: D1Database, appId: string, keyMaterial: string | undefined) {
	const key = requireKey(keyMaterial);
	const app = await db.prepare('SELECT kitchen_id AS kitchenId FROM apps WHERE id = ?').bind(appId).first<{ kitchenId: string }>();
	if (!app) throw new Error('App not found.');
	const rows = await db.prepare(
		`SELECT name, ciphertext, iv FROM secrets WHERE kitchen_id = ?
		 UNION ALL SELECT name, ciphertext, iv FROM secrets WHERE app_id = ?`
	).bind(app.kitchenId, appId).all<{ name: string; ciphertext: string; iv: string }>();
	const values: Record<string, string> = {};
	for (const row of rows.results) {
		const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(row.iv) }, await encryptionKey(key), decode(row.ciphertext));
		values[row.name] = decoder.decode(plain);
	}
	return values;
}

export async function listAppSecrets(db: D1Database, userId: string, appId: string) {
	const app = await getAppAccess(db, userId, appId);
	if (!app) throw error(404, 'App not found.');
	const [kitchen, own] = await Promise.all([
		db.prepare('SELECT id, name, created_at AS createdAt, updated_at AS updatedAt FROM secrets WHERE kitchen_id = ? ORDER BY name').bind(app.kitchenId).all<Omit<SecretMetadata, 'scope'>>(),
		db.prepare('SELECT id, name, created_at AS createdAt, updated_at AS updatedAt FROM secrets WHERE app_id = ? ORDER BY name').bind(appId).all<Omit<SecretMetadata, 'scope'>>()
	]);
	const kitchenNames = new Set(kitchen.results.map((secret) => secret.name));
	return {
		app,
		kitchen: kitchen.results.map((secret) => ({ ...secret, scope: 'kitchen' as const })),
		appSecrets: own.results.map((secret) => ({ ...secret, scope: 'app' as const, overridesKitchenSecret: kitchenNames.has(secret.name) }))
	};
}

export async function saveSecret(db: D1Database, userId: string, appId: string, scope: SecretScope, name: string, value: string, keyMaterial: string | undefined) {
	if (!namePattern.test(name)) throw error(400, 'Secret names must be uppercase environment-variable names.');
	if (!value) throw error(400, 'Enter a secret value.');
	const app = await getAppAccess(db, userId, appId);
	if (!app) throw error(404, 'App not found.');
	if (scope === 'kitchen' && app.role !== 'head_chef') throw error(403, 'Only a Head Chef can manage Kitchen secrets.');
	const encrypted = await encrypt(value, requireKey(keyMaterial));
	const timestamp = new Date().toISOString();
	const scopeColumn = scope === 'kitchen' ? 'kitchen_id' : 'app_id';
	const scopeId = scope === 'kitchen' ? app.kitchenId : appId;
	await db.prepare(
		`INSERT INTO secrets (id, ${scopeColumn}, name, ciphertext, iv, created_by, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(${scopeColumn}, name) DO UPDATE SET ciphertext = excluded.ciphertext, iv = excluded.iv, updated_at = excluded.updated_at`
	).bind(crypto.randomUUID(), scopeId, name, encrypted.ciphertext, encrypted.iv, userId, timestamp, timestamp).run();
	return { scope, name };
}

export async function deleteSecret(db: D1Database, userId: string, appId: string, scope: SecretScope, name: string) {
	const app = await getAppAccess(db, userId, appId);
	if (!app) throw error(404, 'App not found.');
	if (scope === 'kitchen' && app.role !== 'head_chef') throw error(403, 'Only a Head Chef can manage Kitchen secrets.');
	await db.prepare(`DELETE FROM secrets WHERE ${scope === 'kitchen' ? 'kitchen_id' : 'app_id'} = ? AND name = ?`)
		.bind(scope === 'kitchen' ? app.kitchenId : appId, name).run();
}
