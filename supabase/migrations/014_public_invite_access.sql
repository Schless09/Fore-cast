-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can read active league invites" ON league_invites;
DROP POLICY IF EXISTS "Anyone can read league names" ON leagues;

-- Enable public read access for league invites (for viewing invite details before signup)
CREATE POLICY "Anyone can read active league invites"
ON league_invites
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Enable public read access for league names (needed for invite links)
CREATE POLICY "Anyone can read league names"
ON leagues
FOR SELECT
TO anon, authenticated
USING (true);
