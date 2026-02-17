-- CLEAN FIX for RLS policies
-- This script is idempotent - safe to run multiple times

-- ===== PROFILES TABLE =====

-- Drop and recreate all SELECT policies on profiles
DROP POLICY IF EXISTS "Users can view profiles in their league" ON profiles;
DROP POLICY IF EXISTS "Users can view own league" ON profiles;

-- Ensure "Users can view own profile" exists
DO $$ 
BEGIN
  -- Drop first if it exists, then recreate with correct definition
  DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
  
  CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT
    TO public
    USING (auth.uid() = id);
END $$;

-- Create league viewing policy
CREATE POLICY "Users can view profiles in their league" ON profiles
  FOR SELECT
  TO authenticated
  USING (
    active_league_id IS NOT NULL 
    AND EXISTS (
      SELECT 1
      FROM profiles AS user_profile
      WHERE user_profile.id = auth.uid()
      AND user_profile.active_league_id = profiles.active_league_id
    )
  );

-- ===== USER_ROSTERS TABLE =====

-- Drop all existing policies on user_rosters
DROP POLICY IF EXISTS "Users can view rosters from their league" ON user_rosters;
DROP POLICY IF EXISTS "Users can view own rosters" ON user_rosters;
DROP POLICY IF EXISTS "Users can only view their own rosters" ON user_rosters;
DROP POLICY IF EXISTS "Users can view their rosters" ON user_rosters;

-- Create new SELECT policy for user_rosters
CREATE POLICY "Users can view rosters from their league" ON user_rosters
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles AS roster_owner
      WHERE roster_owner.id = user_rosters.user_id
      AND roster_owner.active_league_id IN (
        SELECT active_league_id
        FROM profiles
        WHERE id = auth.uid()
      )
    )
  );

-- Recreate other user_rosters policies if they don't exist

DROP POLICY IF EXISTS "Users can create their own rosters" ON user_rosters;
CREATE POLICY "Users can create their own rosters" ON user_rosters
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own rosters" ON user_rosters;
CREATE POLICY "Users can update their own rosters" ON user_rosters
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own rosters" ON user_rosters;
CREATE POLICY "Users can delete their own rosters" ON user_rosters
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ===== VERIFY =====

-- Show all policies on both tables
SELECT 'PROFILES POLICIES' as table_name, policyname, cmd 
FROM pg_policies 
WHERE tablename = 'profiles'
UNION ALL
SELECT 'USER_ROSTERS POLICIES', policyname, cmd 
FROM pg_policies 
WHERE tablename = 'user_rosters'
ORDER BY table_name, cmd, policyname;
