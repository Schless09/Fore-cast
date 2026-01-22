-- ROLLBACK AND FIX for migration 012
-- Run this to fix the 500 errors on profiles

-- First, restore the original "Users can view own profile" policy
DROP POLICY IF EXISTS "Users can view profiles in their league" ON profiles;
DROP POLICY IF EXISTS "Users can view own league" ON profiles;

-- Recreate "Users can view own profile" if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Users can view own profile'
  ) THEN
    CREATE POLICY "Users can view own profile" ON profiles
      FOR SELECT
      TO public
      USING (auth.uid() = id);
  END IF;
END $$;

-- Now create the CORRECT league viewing policy (in addition to own profile)
CREATE POLICY "Users can view profiles in their league" ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Allow viewing profiles of users in the same league
    active_league_id IS NOT NULL 
    AND EXISTS (
      SELECT 1
      FROM profiles AS user_profile
      WHERE user_profile.id = auth.uid()
      AND user_profile.active_league_id = profiles.active_league_id
    )
  );

-- Verify policies
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'profiles' 
AND cmd = 'SELECT';
