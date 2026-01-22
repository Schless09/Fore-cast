-- Fix INSERT policy on user_rosters table
-- Users are getting 403 Forbidden when trying to create rosters

-- Check current policies
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_rosters'
ORDER BY cmd;

-- The policy might have been dropped or misconfigured
-- Let's ensure the INSERT policy exists

DROP POLICY IF EXISTS "Users can create their own rosters" ON user_rosters;
CREATE POLICY "Users can create their own rosters" ON user_rosters
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Also ensure roster_players table has proper INSERT policy
DROP POLICY IF EXISTS "Users can add players to their rosters" ON roster_players;
CREATE POLICY "Users can add players to their rosters" ON roster_players
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_rosters
      WHERE user_rosters.id = roster_players.roster_id
      AND user_rosters.user_id = auth.uid()
    )
  );

-- Verify the policies
SELECT 
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN ('user_rosters', 'roster_players')
ORDER BY tablename, cmd;
