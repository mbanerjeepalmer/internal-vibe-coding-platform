-- Each App's source is snapshotted into the ivcp-app-source R2 bucket (see
-- src/lib/server/app-source.ts) so it survives its disposable sandbox being
-- destroyed or lost, without depending on GitHub. This column is just a
-- display timestamp ("source saved 2 minutes ago") — the R2 object itself,
-- keyed by App id, is the source of truth for whether a snapshot exists.
ALTER TABLE apps ADD COLUMN source_saved_at TEXT;
