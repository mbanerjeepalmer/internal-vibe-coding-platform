-- The `secrets` table was reserved in the initial control-plane schema. This
-- migration records non-sensitive audit metadata for its first live use.
CREATE INDEX IF NOT EXISTS secrets_kitchen_idx ON secrets(kitchen_id, name);
CREATE INDEX IF NOT EXISTS secrets_app_idx ON secrets(app_id, name);
