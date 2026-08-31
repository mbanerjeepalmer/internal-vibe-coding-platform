-- The Executive Chef role: instance-wide superadmin, orthogonal to
-- organisation/Kitchen membership. There is no UI path to create the first
-- one — see AGENTS.md for the one-time `wrangler d1 execute` bootstrap.
CREATE TABLE IF NOT EXISTS platform_admins (
	user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
	granted_by TEXT REFERENCES "user"(id),
	created_at TEXT NOT NULL
);

-- Every raw-SQL and sandbox-bash invocation from the Executive Chef console,
-- successful or not, so there's always a durable answer to "who ran what,
-- and why." Comment is required unless the actor explicitly forced past that
-- requirement (forced = 1) — still logged either way.
CREATE TABLE IF NOT EXISTS admin_actions (
	id TEXT PRIMARY KEY,
	actor_id TEXT NOT NULL REFERENCES "user"(id),
	kitchen_id TEXT REFERENCES kitchens(id) ON DELETE SET NULL,
	app_id TEXT REFERENCES apps(id) ON DELETE SET NULL,
	kind TEXT NOT NULL CHECK (kind IN ('sql', 'bash')),
	command TEXT NOT NULL,
	comment TEXT,
	forced INTEGER NOT NULL DEFAULT 0,
	status TEXT NOT NULL CHECK (status IN ('ok', 'error')),
	result TEXT,
	created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_actions_created_idx ON admin_actions(created_at DESC);
