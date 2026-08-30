-- Lets a Kitchen's Head Chef override the platform-wide default model
-- (Luna, see src/lib/server/opencode/client.ts's DEFAULT_MODEL) for every app
-- in that Kitchen. NULL means "use the platform default."
ALTER TABLE kitchens ADD COLUMN default_model_id TEXT;
ALTER TABLE kitchens ADD COLUMN default_model_provider_id TEXT;
