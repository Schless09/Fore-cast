-- Remove the old overly permissive policy that allows viewing ALL rosters
-- Keep only the league-specific policy

DROP POLICY IF EXISTS "Authenticated users can view all rosters" ON user_rosters;

-- Verify only the correct policy remains
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'user_rosters' 
AND cmd = 'SELECT';
