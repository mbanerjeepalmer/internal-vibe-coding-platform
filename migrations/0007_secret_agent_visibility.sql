-- Distinguishes secrets the coding agent's sandbox should receive as
-- environment variables (the existing behaviour — e.g. an API key the
-- agent-written app calls) from platform-operational secrets like a
-- Cloudflare deploy token, which the agent must never see on its shell.
-- Defaults to 1 so every existing secret keeps behaving exactly as before.
ALTER TABLE secrets ADD COLUMN agent_visible INTEGER NOT NULL DEFAULT 1;
