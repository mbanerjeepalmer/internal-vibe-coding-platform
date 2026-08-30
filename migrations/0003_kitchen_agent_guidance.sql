-- Head-Chef-authored guidance is materialised as a project-local OpenCode skill
-- whenever an App sandbox starts or is revisited.
ALTER TABLE kitchens ADD COLUMN agent_guidance TEXT NOT NULL DEFAULT '';
