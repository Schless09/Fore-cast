-- Create league invites table for shareable invite links

CREATE TABLE IF NOT EXISTS league_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ, -- NULL means never expires
  max_uses INTEGER, -- NULL means unlimited uses
  current_uses INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_league_invites_code ON league_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_league_invites_league_id ON league_invites(league_id);

-- Enable RLS
ALTER TABLE league_invites ENABLE ROW LEVEL SECURITY;

-- Policies for league_invites
-- Anyone can view active, non-expired invites (needed for invite links to work)
CREATE POLICY "Anyone can view active invites" ON league_invites
  FOR SELECT
  TO authenticated
  USING (
    is_active = true 
    AND (expires_at IS NULL OR expires_at > now())
  );

-- League members can create invites for their league
CREATE POLICY "League members can create invites" ON league_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM league_members
      WHERE league_members.league_id = league_invites.league_id
      AND league_members.user_id = auth.uid()
    )
  );

-- Creators can update/delete their own invites
CREATE POLICY "Creators can manage their invites" ON league_invites
  FOR ALL
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Function to generate a unique invite code
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 8-character alphanumeric code
    code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM league_invites WHERE invite_code = code) INTO exists;
    
    EXIT WHEN NOT exists;
  END LOOP;
  
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE league_invites IS 'Stores invite links for leagues that can be shared with friends';
COMMENT ON COLUMN league_invites.invite_code IS 'Unique 8-character code used in invite URLs';
COMMENT ON COLUMN league_invites.max_uses IS 'Maximum number of times this invite can be used. NULL = unlimited';
COMMENT ON COLUMN league_invites.expires_at IS 'When this invite expires. NULL = never expires';
