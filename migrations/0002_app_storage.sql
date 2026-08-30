-- Each App owns an isolated D1 database.  The database itself is created lazily
-- by the deploy path, once the App is authorised and Cloudflare credentials are
-- available; this table only records its non-secret identifier.
CREATE TABLE IF NOT EXISTS app_storage (
	app_id TEXT PRIMARY KEY REFERENCES apps(id) ON DELETE CASCADE,
	database_id TEXT NOT NULL UNIQUE,
	database_name TEXT NOT NULL UNIQUE,
	created_at TEXT NOT NULL
);
