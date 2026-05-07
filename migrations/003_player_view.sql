-- Player View feature
-- Invite links, player sessions, and per-node player notes

CREATE TABLE IF NOT EXISTS campaign_invites (
  id             TEXT PRIMARY KEY,
  campaign_id    TEXT NOT NULL,
  owner_user_id  TEXT NOT NULL,
  token          TEXT NOT NULL UNIQUE,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS player_sessions (
  id             TEXT PRIMARY KEY,
  invite_id      TEXT NOT NULL,
  campaign_id    TEXT NOT NULL,
  owner_user_id  TEXT NOT NULL,
  display_name   TEXT NOT NULL,
  color          TEXT NOT NULL,
  token          TEXT NOT NULL UNIQUE,
  status         TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at    TEXT,
  FOREIGN KEY (invite_id) REFERENCES campaign_invites(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS player_notes (
  id                TEXT PRIMARY KEY,
  player_session_id TEXT NOT NULL,
  campaign_id       TEXT NOT NULL,
  node_id           TEXT NOT NULL,
  text              TEXT NOT NULL DEFAULT '',
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (player_session_id, node_id),
  FOREIGN KEY (player_session_id) REFERENCES player_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_campaign_invites_owner  ON campaign_invites(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_player_sessions_invite  ON player_sessions(invite_id);
CREATE INDEX IF NOT EXISTS idx_player_sessions_token   ON player_sessions(token);
CREATE INDEX IF NOT EXISTS idx_player_notes_session    ON player_notes(player_session_id);
CREATE INDEX IF NOT EXISTS idx_player_notes_node       ON player_notes(campaign_id, node_id);
