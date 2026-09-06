-- Lets a Head Chef give their Kitchen a short description (shown alongside
-- its name on the dashboard) and rename it (see the existing UNIQUE
-- (organisation_id, name) constraint from migration 0001 — a rename that
-- collides with a sibling Kitchen's name is rejected).
ALTER TABLE kitchens ADD COLUMN description TEXT NOT NULL DEFAULT '';

-- Records which skills from the built-in catalog (src/lib/server/skills.ts)
-- a Kitchen's Head Chef has turned on. Selected skills are materialised into
-- every App's sandbox alongside the Kitchen's free-text agent guidance (see
-- sandbox.ts) — the "Kitchen defaults" half of AGENTS.md's wrapper step 5.
-- skill_id is a catalog id, not a foreign key: the catalog lives in code, not
-- the database, so a skill removed from the catalog in a later release simply
-- stops being materialised rather than failing a constraint.
CREATE TABLE IF NOT EXISTS kitchen_skills (
	kitchen_id TEXT NOT NULL REFERENCES kitchens(id) ON DELETE CASCADE,
	skill_id TEXT NOT NULL,
	created_at TEXT NOT NULL,
	PRIMARY KEY (kitchen_id, skill_id)
);
