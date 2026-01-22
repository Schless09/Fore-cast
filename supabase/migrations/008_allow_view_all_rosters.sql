-- Allow authenticated users to view all rosters (needed for standings/leaderboards)
-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can view own rosters" ON user_rosters;

-- Create new policy that allows all authenticated users to view all rosters
CREATE POLICY "Authenticated users can view all rosters"
  ON user_rosters FOR SELECT
  TO authenticated
  USING (true);

-- Keep the other policies restrictive (users can only modify their own)
-- "Users can create own rosters" - already exists, no change
-- "Users can update own rosters" - already exists, no change  
-- "Users can delete own rosters" - already exists, no change

COMMENT ON POLICY "Authenticated users can view all rosters" ON user_rosters 
IS 'Allow all authenticated users to view rosters for leaderboards and standings';
