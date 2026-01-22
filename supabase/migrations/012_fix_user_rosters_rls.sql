-- Fix RLS policies for user_rosters AND profiles to allow league members to view each other's data
-- This is necessary for the standings pages to show all league members

-- ===== FIX PROFILES TABLE RLS =====
-- Users need to be able to view profiles of other users in their league
-- This is required because the standings query joins user_rosters with profiles

-- IMPORTANT: Don't drop "Users can view own profile" - it's needed for basic functionality
-- Only drop the conflicting league policy
DROP POLICY IF EXISTS "Users can view own league" ON profiles;

-- Ensure "Users can view own profile" exists
-- (This is safe - will error if it exists, but that's fine since we want it to exist)
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

-- Create new policy: Users can view profiles of users in their league
-- This is IN ADDITION to viewing own profile
DROP POLICY IF EXISTS "Users can view profiles in their league" ON profiles;
CREATE POLICY "Users can view profiles in their league" ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Allow viewing profiles of users in the same league
    -- But only if both users have an active_league_id set
    active_league_id IS NOT NULL 
    AND EXISTS (
      SELECT 1
      FROM profiles AS user_profile
      WHERE user_profile.id = auth.uid()
      AND user_profile.active_league_id = profiles.active_league_id
    )
  );

-- Keep existing insert/update policies (unchanged)
-- Users can still only update their own profile

-- ===== FIX USER_ROSTERS TABLE RLS =====

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view own rosters" ON user_rosters;
DROP POLICY IF EXISTS "Users can only view their own rosters" ON user_rosters;
DROP POLICY IF EXISTS "Users can view their rosters" ON user_rosters;

-- Create new policy: Users can view rosters from users in their league
-- This allows the standings page to show all league members' rosters
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

-- Users can still only insert their own rosters
DROP POLICY IF EXISTS "Users can create own rosters" ON user_rosters;
DROP POLICY IF EXISTS "Users can insert own rosters" ON user_rosters;
DROP POLICY IF EXISTS "Users can create their rosters" ON user_rosters;

CREATE POLICY "Users can create their own rosters" ON user_rosters
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can still only update their own rosters
DROP POLICY IF EXISTS "Users can update own rosters" ON user_rosters;
DROP POLICY IF EXISTS "Users can update their rosters" ON user_rosters;

CREATE POLICY "Users can update their own rosters" ON user_rosters
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can still only delete their own rosters
DROP POLICY IF EXISTS "Users can delete own rosters" ON user_rosters;
DROP POLICY IF EXISTS "Users can delete their rosters" ON user_rosters;

CREATE POLICY "Users can delete their own rosters" ON user_rosters
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
