-- Lets a chef restrict who can use a deployed app, by specific email or
-- email domain, enforced via a Cloudflare Access policy attached directly
-- to the app's Worker (see src/lib/server/cloudflare-access.ts).
ALTER TABLE apps ADD COLUMN cf_worker_id TEXT;
ALTER TABLE apps ADD COLUMN cf_access_app_id TEXT;

CREATE TABLE IF NOT EXISTS app_access_rules (
	id TEXT PRIMARY KEY,
	app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
	rule_type TEXT NOT NULL CHECK (rule_type IN ('email', 'domain')),
	value TEXT NOT NULL,
	created_by TEXT NOT NULL REFERENCES "user"("id"),
	created_at TEXT NOT NULL,
	UNIQUE (app_id, rule_type, value)
);

CREATE INDEX IF NOT EXISTS idx_app_access_rules_app ON app_access_rules(app_id);
