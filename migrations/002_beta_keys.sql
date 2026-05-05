-- Beta access key system
-- Keys are single-use; used_by is set to the user_id that redeemed the key.

CREATE TABLE IF NOT EXISTS beta_keys (
  key        TEXT PRIMARY KEY,
  note       TEXT    NOT NULL DEFAULT '',
  used_by    TEXT    REFERENCES users(id),
  used_at    TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
