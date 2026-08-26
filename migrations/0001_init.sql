-- Phase 2: accounts + subscriptions. See BRIEF.md for product context.
--
-- Apply locally:  wrangler d1 execute fitcheckai-db --file=migrations/0001_init.sql
-- Apply to prod:  wrangler d1 execute fitcheckai-db --file=migrations/0001_init.sql --remote

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);

CREATE TABLE subscriptions (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'none',
  plan TEXT NOT NULL DEFAULT 'free',
  updated_at TEXT NOT NULL
);
