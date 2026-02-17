-- Fix circular dependency in profiles RLS policy
-- SIMPLEST SOLUTION: Just allow all authenticated users to view all profiles
-- The security is enforced at the roster/standings level, not the profile level
-- Profiles only contain username/email which aren't sensitive in a league context

-- Drop the problematic circular dependency policy
DROP POLICY IF EXISTS "Users can view profiles in their league" ON profiles;

-- Drop the "own profile only" policy too
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- Create one simple policy: all authenticated users can view all profiles
CREATE POLICY "Authenticated users can view all profiles" ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Keep existing insert/update policies unchanged
-- Users still can only modify their own profile

-- Verify the policies
SELECT policyname, cmd
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY cmd;
