-- Fix: Add INSERT policy for leagues table
-- The leagues table had RLS enabled but no INSERT policy, blocking league creation

-- Allow authenticated users to create leagues
DROP POLICY IF EXISTS "Authenticated users can create leagues" ON leagues;
CREATE POLICY "Authenticated users can create leagues" ON leagues
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Also allow users to view all leagues (for join functionality)
-- The original policy only allowed viewing own league
DROP POLICY IF EXISTS "Anyone can view league names" ON leagues;
CREATE POLICY "Authenticated users can view all leagues" ON leagues
  FOR SELECT
  TO authenticated
  USING (true);

-- Verify the policies
SELECT 
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'leagues'
ORDER BY cmd;
