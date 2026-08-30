PRAGMA foreign_keys = ON;

-- Better Auth's core D1 tables.
CREATE TABLE IF NOT EXISTS "user" (
	"id" TEXT PRIMARY KEY,
	"name" TEXT NOT NULL,
	"email" TEXT NOT NULL UNIQUE,
	"emailVerified" INTEGER NOT NULL DEFAULT 0,
	"image" TEXT,
	"createdAt" TEXT NOT NULL,
	"updatedAt" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "session" (
	"id" TEXT PRIMARY KEY,
	"expiresAt" TEXT NOT NULL,
	"token" TEXT NOT NULL UNIQUE,
	"createdAt" TEXT NOT NULL,
	"updatedAt" TEXT NOT NULL,
	"ipAddress" TEXT,
	"userAgent" TEXT,
	"userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session"("userId");

CREATE TABLE IF NOT EXISTS "account" (
	"id" TEXT PRIMARY KEY,
	"accountId" TEXT NOT NULL,
	"providerId" TEXT NOT NULL,
	"userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"accessToken" TEXT,
	"refreshToken" TEXT,
	"idToken" TEXT,
	"accessTokenExpiresAt" TEXT,
	"refreshTokenExpiresAt" TEXT,
	"scope" TEXT,
	"password" TEXT,
	"createdAt" TEXT NOT NULL,
	"updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account"("userId");

CREATE TABLE IF NOT EXISTS "verification" (
	"id" TEXT PRIMARY KEY,
	"identifier" TEXT NOT NULL,
	"value" TEXT NOT NULL,
	"expiresAt" TEXT NOT NULL,
	"createdAt" TEXT,
	"updatedAt" TEXT
);

CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification"("identifier");

CREATE TABLE IF NOT EXISTS organisations (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	repository_url TEXT,
	default_branch TEXT NOT NULL DEFAULT 'main',
	created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS organisation_memberships (
	organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
	user_id TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
	created_at TEXT NOT NULL,
	PRIMARY KEY (organisation_id, user_id)
);

CREATE TABLE IF NOT EXISTS kitchens (
	id TEXT PRIMARY KEY,
	organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
	name TEXT NOT NULL,
	created_at TEXT NOT NULL,
	UNIQUE (organisation_id, name)
);

CREATE TABLE IF NOT EXISTS kitchen_memberships (
	kitchen_id TEXT NOT NULL REFERENCES kitchens(id) ON DELETE CASCADE,
	user_id TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	role TEXT NOT NULL CHECK (role IN ('head_chef', 'chef')),
	created_at TEXT NOT NULL,
	PRIMARY KEY (kitchen_id, user_id)
);

CREATE TABLE IF NOT EXISTS apps (
	id TEXT PRIMARY KEY,
	kitchen_id TEXT NOT NULL REFERENCES kitchens(id) ON DELETE CASCADE,
	name TEXT NOT NULL,
	created_by TEXT NOT NULL REFERENCES "user"("id"),
	git_branch TEXT NOT NULL,
	current_revision TEXT,
	sandbox_id TEXT,
	sandbox_state TEXT NOT NULL DEFAULT 'not_started',
	opencode_session_id TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	UNIQUE (kitchen_id, name),
	UNIQUE (kitchen_id, git_branch)
);

CREATE INDEX IF NOT EXISTS apps_kitchen_idx ON apps(kitchen_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS invitations (
	id TEXT PRIMARY KEY,
	organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
	kitchen_id TEXT REFERENCES kitchens(id) ON DELETE CASCADE,
	email TEXT NOT NULL,
	organisation_role TEXT NOT NULL CHECK (organisation_role IN ('owner', 'member')),
	kitchen_role TEXT CHECK (kitchen_role IN ('head_chef', 'chef')),
	token_hash TEXT NOT NULL UNIQUE,
	expires_at TEXT NOT NULL,
	accepted_at TEXT,
	revoked_at TEXT,
	created_by TEXT NOT NULL REFERENCES "user"("id"),
	created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS invitations_email_idx ON invitations(email, expires_at);

CREATE TABLE IF NOT EXISTS secrets (
	id TEXT PRIMARY KEY,
	kitchen_id TEXT REFERENCES kitchens(id) ON DELETE CASCADE,
	app_id TEXT REFERENCES apps(id) ON DELETE CASCADE,
	name TEXT NOT NULL,
	ciphertext TEXT NOT NULL,
	iv TEXT NOT NULL,
	created_by TEXT NOT NULL REFERENCES "user"("id"),
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	CHECK ((kitchen_id IS NOT NULL AND app_id IS NULL) OR (kitchen_id IS NULL AND app_id IS NOT NULL)),
	UNIQUE (kitchen_id, name),
	UNIQUE (app_id, name)
);

CREATE TABLE IF NOT EXISTS activity_events (
	id TEXT PRIMARY KEY,
	organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
	actor_id TEXT REFERENCES "user"("id") ON DELETE SET NULL,
	resource_type TEXT NOT NULL,
	resource_id TEXT NOT NULL,
	action TEXT NOT NULL,
	created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS activity_organisation_idx ON activity_events(organisation_id, created_at DESC);
