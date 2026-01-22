-- Migration to support users being in multiple leagues
-- Creates a many-to-many relationship between users and leagues

-- Create league_members junction table
CREATE TABLE IF NOT EXISTS league_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(user_id, league_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_league_members_user_id ON league_members(user_id);
CREATE INDEX IF NOT EXISTS idx_league_members_league_id ON league_members(league_id);
CREATE INDEX IF NOT EXISTS idx_league_members_active ON league_members(user_id, is_active);

-- Add active_league_id to profiles (which league they're currently viewing)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS active_league_id UUID REFERENCES leagues(id);

-- Migrate existing data from profiles.league_id to league_members
INSERT INTO league_members (user_id, league_id, is_active)
SELECT id, league_id, true
FROM profiles
WHERE league_id IS NOT NULL
ON CONFLICT (user_id, league_id) DO NOTHING;

-- Set active_league_id to their current league_id
UPDATE profiles
SET active_league_id = league_id
WHERE league_id IS NOT NULL AND active_league_id IS NULL;

-- Don't drop league_id yet in case we need to rollback
-- ALTER TABLE profiles DROP COLUMN league_id;

-- Enable RLS on league_members
ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for league_members
-- Users can view their own league memberships
CREATE POLICY "Users can view own league memberships"
  ON league_members FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own league memberships (for joining)
CREATE POLICY "Users can join leagues"
  ON league_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own memberships (for switching active league)
CREATE POLICY "Users can update own memberships"
  ON league_members FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own memberships (for leaving)
CREATE POLICY "Users can leave leagues"
  ON league_members FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE league_members IS 'Junction table for users belonging to multiple leagues';
COMMENT ON COLUMN league_members.is_active IS 'Whether this is the users currently active/selected league';
COMMENT ON COLUMN profiles.active_league_id IS 'The league the user is currently viewing/interacting with';
