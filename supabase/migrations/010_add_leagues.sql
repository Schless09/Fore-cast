-- Create leagues table
CREATE TABLE IF NOT EXISTS leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add league_id to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS league_id UUID REFERENCES leagues(id);

-- Create index for league lookups
CREATE INDEX IF NOT EXISTS idx_profiles_league_id ON profiles(league_id);

-- Insert the default "BamaBoys2026" league
INSERT INTO leagues (name, password) 
VALUES ('BamaBoys2026', 'Season7')
ON CONFLICT (name) DO NOTHING;

-- Update all existing users to be in BamaBoys2026 league
UPDATE profiles
SET league_id = (SELECT id FROM leagues WHERE name = 'BamaBoys2026')
WHERE league_id IS NULL;

-- Add comments
COMMENT ON TABLE leagues IS 'Leagues for different friend groups';
COMMENT ON COLUMN profiles.league_id IS 'The league this user belongs to';

-- Enable RLS on leagues
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;

-- RLS Policies for leagues
-- Users can view any league name (for join form)
CREATE POLICY "Anyone can view league names"
  ON leagues FOR SELECT
  TO authenticated
  USING (true);

-- Users can view their own league details
CREATE POLICY "Users can view own league"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Update function for updated_at
CREATE OR REPLACE FUNCTION update_leagues_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leagues_updated_at
  BEFORE UPDATE ON leagues
  FOR EACH ROW
  EXECUTE FUNCTION update_leagues_updated_at();
