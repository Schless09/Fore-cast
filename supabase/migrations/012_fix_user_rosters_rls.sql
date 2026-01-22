-- Fix RLS policies for user_rosters AND profiles to allow league members to view each other's data
-- This is necessary for the standings pages to show all league members

-- ===== FIX PROFILES TABLE RLS =====
-- Users need to be able to view profiles of other users in their league
-- This is required because the standings query joins user_rosters with profiles

-- Drop old restrictive profile view policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own league" ON profiles;

-- Create new policy: Users can view profiles of users in their league
CREATE POLICY "Users can view profiles in their league" ON profiles
  FOR SELECT
  TO authenticated
  USING (
    active_league_id IN (
      SELECT active_league_id
      FROM profiles
      WHERE id = auth.uid()
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
