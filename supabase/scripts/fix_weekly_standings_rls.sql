-- Fix for Weekly Standings RLS Issue
-- The problem: Users can't see rosters because RLS is blocking the query

-- ===== STEP 1: Identify the issue =====
-- Check which users don't have an active_league_id
SELECT 
  p.id,
  p.username,
  p.active_league_id,
  COUNT(lm.league_id) as league_memberships
FROM profiles p
LEFT JOIN league_members lm ON p.id = lm.user_id
GROUP BY p.id, p.username, p.active_league_id
ORDER BY p.username;

-- ===== STEP 2: Fix the RLS policy on profiles =====
-- The current policy requires active_league_id IS NOT NULL which is too restrictive
-- We need to allow users to view other profiles even if active_league_id is not set

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can view profiles in their league" ON profiles;

-- Create a more permissive policy that allows viewing profiles of league members
-- This checks the league_members table instead of active_league_id
CREATE POLICY "Users can view profiles in their league" ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Allow viewing own profile
    auth.uid() = id
    OR
    -- Allow viewing profiles of users in the same league(s)
    EXISTS (
      SELECT 1
      FROM league_members lm1
      INNER JOIN league_members lm2 ON lm1.league_id = lm2.league_id
      WHERE lm1.user_id = auth.uid()
      AND lm2.user_id = profiles.id
    )
    OR
    -- TEMPORARY: Allow viewing all profiles if user doesn't have a league yet
    -- This ensures the app doesn't break for users without leagues
    NOT EXISTS (
      SELECT 1 FROM league_members WHERE user_id = auth.uid()
    )
  );

-- ===== STEP 3: Fix the RLS policy on user_rosters =====
-- The current policy only shows rosters from users with matching active_league_id
-- We need to check the league_members table instead

DROP POLICY IF EXISTS "Users can view rosters from their league" ON user_rosters;

CREATE POLICY "Users can view rosters from their league" ON user_rosters
  FOR SELECT
  TO authenticated
  USING (
    -- Allow viewing own rosters
    auth.uid() = user_id
    OR
    -- Allow viewing rosters from users in the same league(s)
    EXISTS (
      SELECT 1
      FROM league_members lm1
      INNER JOIN league_members lm2 ON lm1.league_id = lm2.league_id
      WHERE lm1.user_id = auth.uid()
      AND lm2.user_id = user_rosters.user_id
    )
    OR
    -- TEMPORARY: Allow viewing all rosters if user doesn't have a league yet
    -- This ensures the app doesn't break for users without leagues
    NOT EXISTS (
      SELECT 1 FROM league_members WHERE user_id = auth.uid()
    )
  );

-- ===== STEP 4: Ensure all users are in a default league =====
-- Option A: Create a default league if one doesn't exist
DO $$
DECLARE
  default_league_id UUID;
BEGIN
  -- Check if a "Default League" exists
  SELECT id INTO default_league_id
  FROM leagues
  WHERE name = 'Default League'
  LIMIT 1;
  
  -- If not, create it (using the first user as creator)
  IF default_league_id IS NULL THEN
    INSERT INTO leagues (name, created_by)
    SELECT 'Default League', id
    FROM profiles
    LIMIT 1
    RETURNING id INTO default_league_id;
    
    RAISE NOTICE 'Created Default League with ID: %', default_league_id;
  END IF;
  
  -- Add all users who aren't in any league to the default league
  INSERT INTO league_members (league_id, user_id)
  SELECT default_league_id, p.id
  FROM profiles p
  WHERE NOT EXISTS (
    SELECT 1 FROM league_members lm WHERE lm.user_id = p.id
  )
  ON CONFLICT DO NOTHING;
  
  -- Set active_league_id for users who don't have one
  UPDATE profiles
  SET active_league_id = default_league_id
  WHERE active_league_id IS NULL;
  
  RAISE NOTICE 'All users are now in the Default League';
END $$;

-- ===== STEP 5: Verify the fix =====
-- Check that all users now have an active_league_id
SELECT 
  p.id,
  p.username,
  p.active_league_id,
  l.name as league_name,
  COUNT(lm.league_id) as league_memberships
FROM profiles p
LEFT JOIN leagues l ON p.active_league_id = l.id
LEFT JOIN league_members lm ON p.id = lm.user_id
GROUP BY p.id, p.username, p.active_league_id, l.name
ORDER BY p.username;

-- ===== STEP 6: Test the standings query =====
-- Get The American Express tournament
WITH tournament_info AS (
  SELECT id, name
  FROM tournaments
  WHERE name LIKE '%American Express%'
  ORDER BY start_date DESC
  LIMIT 1
)
SELECT 
  ur.id,
  ur.roster_name,
  p.username,
  p.active_league_id,
  l.name as league_name,
  ur.total_winnings
FROM user_rosters ur
INNER JOIN profiles p ON ur.user_id = p.id
LEFT JOIN leagues l ON p.active_league_id = l.id
WHERE ur.tournament_id = (SELECT id FROM tournament_info)
ORDER BY ur.total_winnings DESC;
