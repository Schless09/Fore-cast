-- Create conversations table for DMs between league members
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1 TEXT NOT NULL,  -- Clerk user ID
  participant_2 TEXT NOT NULL,  -- Clerk user ID
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure unique conversation between two users in a league
  UNIQUE(participant_1, participant_2, league_id)
);

-- Create conversation_messages table
CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,  -- Clerk user ID
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,  -- NULL if unread
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_participant_1 ON conversations(participant_1);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_2 ON conversations(participant_2);
CREATE INDEX IF NOT EXISTS idx_conversations_league_id ON conversations(league_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_created ON conversation_messages(created_at DESC);

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations

-- Users can view conversations they're part of
CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  USING (participant_1 = current_setting('request.jwt.claims', true)::json->>'sub' 
      OR participant_2 = current_setting('request.jwt.claims', true)::json->>'sub');

-- Users can create conversations (we'll validate participants server-side)
CREATE POLICY "Users can create conversations"
  ON conversations FOR INSERT
  WITH CHECK (true);

-- Users can update conversations they're part of (for last_message_at)
CREATE POLICY "Users can update own conversations"
  ON conversations FOR UPDATE
  USING (participant_1 = current_setting('request.jwt.claims', true)::json->>'sub' 
      OR participant_2 = current_setting('request.jwt.claims', true)::json->>'sub');

-- RLS Policies for conversation_messages

-- Users can view messages in their conversations
CREATE POLICY "Users can view messages in own conversations"
  ON conversation_messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM conversations 
      WHERE participant_1 = current_setting('request.jwt.claims', true)::json->>'sub' 
         OR participant_2 = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

-- Users can send messages to their conversations
CREATE POLICY "Users can send messages"
  ON conversation_messages FOR INSERT
  WITH CHECK (true);

-- Users can update messages (for read_at)
CREATE POLICY "Users can mark messages as read"
  ON conversation_messages FOR UPDATE
  USING (
    conversation_id IN (
      SELECT id FROM conversations 
      WHERE participant_1 = current_setting('request.jwt.claims', true)::json->>'sub' 
         OR participant_2 = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_messages;

-- Comments
COMMENT ON TABLE conversations IS 'Direct message conversations between league members';
COMMENT ON TABLE conversation_messages IS 'Messages within DM conversations';
