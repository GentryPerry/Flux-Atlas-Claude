-- ============================================================
-- Migration 001 — Commercial launch readiness
-- Run with:
--   npx wrangler d1 execute flux-atlas-db --file=migrations/001_commercial.sql
--
-- Safe to re-run: all statements use IF NOT EXISTS / IF NOT EXISTS column guards.
-- ============================================================

-- ── 1. Add plan + billing columns to users ──────────────────────────────────
-- D1/SQLite requires one ALTER per column.

ALTER TABLE users ADD COLUMN plan_key        TEXT NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN plan_status     TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN billing_provider            TEXT;
ALTER TABLE users ADD COLUMN billing_customer_id         TEXT;
ALTER TABLE users ADD COLUMN billing_subscription_id     TEXT;

-- ── 2. Plans reference table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS plans (
  key        TEXT PRIMARY KEY,
  name       TEXT    NOT NULL,
  is_public  INTEGER NOT NULL DEFAULT 1,
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO plans (key, name, is_public, is_active) VALUES
  ('free',            'Free',             1, 1),
  ('pro',             'Pro',              1, 1),
  ('admin_unlimited', 'Admin / Unlimited',0, 1);

-- ── 3. Plan entitlements ─────────────────────────────────────────────────────
-- value = NULL means unlimited.

CREATE TABLE IF NOT EXISTS plan_entitlements (
  plan_key        TEXT    NOT NULL,
  entitlement_key TEXT    NOT NULL,
  value           INTEGER,           -- NULL = unlimited
  PRIMARY KEY (plan_key, entitlement_key),
  FOREIGN KEY (plan_key) REFERENCES plans(key)
);

INSERT OR IGNORE INTO plan_entitlements (plan_key, entitlement_key, value) VALUES
  -- Free limits
  ('free', 'max_campaigns',                      2),
  ('free', 'max_nodes',                        100),
  ('free', 'max_storage_mb',                   100),
  ('free', 'max_custom_node_types',              5),
  ('free', 'max_trouble_generations_per_month', 10),
  ('free', 'max_flux_generations_per_month',    10),
  ('free', 'max_board_history_entries',         25),
  ('free', 'can_restore_history',                0),

  -- Pro limits (NULL = unlimited)
  ('pro', 'max_campaigns',                    NULL),
  ('pro', 'max_nodes',                        NULL),
  ('pro', 'max_storage_mb',                   2048),
  ('pro', 'max_custom_node_types',            NULL),
  ('pro', 'max_trouble_generations_per_month',NULL),
  ('pro', 'max_flux_generations_per_month',   NULL),
  ('pro', 'max_board_history_entries',        NULL),
  ('pro', 'can_restore_history',                 1),

  -- Admin unlimited (all NULL)
  ('admin_unlimited', 'max_campaigns',                    NULL),
  ('admin_unlimited', 'max_nodes',                        NULL),
  ('admin_unlimited', 'max_storage_mb',                   NULL),
  ('admin_unlimited', 'max_custom_node_types',            NULL),
  ('admin_unlimited', 'max_trouble_generations_per_month',NULL),
  ('admin_unlimited', 'max_flux_generations_per_month',   NULL),
  ('admin_unlimited', 'max_board_history_entries',        NULL),
  ('admin_unlimited', 'can_restore_history',                 1);

-- ── 4. Account usage counters ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS account_usage (
  user_id                              TEXT PRIMARY KEY,
  active_campaign_count                INTEGER NOT NULL DEFAULT 0,
  active_node_count                    INTEGER NOT NULL DEFAULT 0,
  storage_bytes_used                   INTEGER NOT NULL DEFAULT 0,
  custom_node_type_count               INTEGER NOT NULL DEFAULT 0,
  trouble_generations_current_period   INTEGER NOT NULL DEFAULT 0,
  flux_generations_current_period      INTEGER NOT NULL DEFAULT 0,
  usage_period_start                   TEXT    NOT NULL DEFAULT (date('now', 'start of month')),
  usage_period_end                     TEXT    NOT NULL DEFAULT (date('now', 'start of month', '+1 month')),
  updated_at                           TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Seed usage rows for all existing users (new users get rows on signup)
INSERT OR IGNORE INTO account_usage (user_id)
  SELECT id FROM users;

CREATE INDEX IF NOT EXISTS idx_account_usage_user ON account_usage(user_id);

-- ── 5. Uploaded files tracking ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS uploaded_files (
  id              TEXT    PRIMARY KEY,
  user_id         TEXT    NOT NULL,
  campaign_id     TEXT,
  file_name       TEXT,
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  mime_type       TEXT,
  storage_key     TEXT    NOT NULL,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  deleted_at      TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_uploaded_files_user    ON uploaded_files(user_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_key     ON uploaded_files(storage_key);
