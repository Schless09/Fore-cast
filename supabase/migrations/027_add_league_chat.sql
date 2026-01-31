-- Create league_messages table for real-time chat
CREATE TABLE IF NOT EXISTS league_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,  -- Clerk user ID
  username TEXT NOT NULL,  -- Cached for display
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fetching messages by league
CREATE INDEX IF NOT EXISTS idx_league_messages_league_id ON league_messages(league_id);
CREATE INDEX IF NOT EXISTS idx_league_messages_created_at ON league_messages(created_at DESC);

-- Enable RLS
ALTER TABLE league_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view messages in their active league
CREATE POLICY "Users can view messages in their league"
  ON league_messages FOR SELECT
  TO authenticated
  USING (
    league_id IN (
      SELECT active_league_id FROM profiles WHERE clerk_id = auth.uid()::text
    )
  );

-- Users can insert messages to their active league
CREATE POLICY "Users can send messages to their league"
  ON league_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    league_id IN (
      SELECT active_league_id FROM profiles WHERE clerk_id = auth.uid()::text
    )
    AND user_id = auth.uid()::text
  );

-- Users can delete their own messages
CREATE POLICY "Users can delete own messages"
  ON league_messages FOR DELETE
  TO authenticated
  USING (user_id = auth.uid()::text);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE league_messages;

-- Add comment
COMMENT ON TABLE league_messages IS 'Real-time chat messages for league members';
