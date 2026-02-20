-- Track when users last read league chat (for unread count)
CREATE TABLE IF NOT EXISTS league_chat_read_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,       -- Clerk user ID
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, league_id)
);

CREATE INDEX IF NOT EXISTS idx_league_chat_read_state_user_league 
  ON league_chat_read_state(user_id, league_id);

-- RLS: All access via API (service client bypasses RLS)
-- No policies = deny anon; service role bypasses RLS
ALTER TABLE league_chat_read_state ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE league_chat_read_state IS 'Tracks when each user last viewed league chat for unread count';
