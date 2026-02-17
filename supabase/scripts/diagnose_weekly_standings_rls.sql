-- Diagnostic script for Weekly Standings RLS issue

-- 1. Check current user profiles and their league assignments
SELECT 
  p.id as user_id,
  p.username,
  p.email,
  p.active_league_id,
  l.name as active_league_name,
  l.id as league_id
FROM profiles p
LEFT JOIN leagues l ON p.active_league_id = l.id
ORDER BY p.username;

-- 2. Check all leagues and their members
SELECT 
  l.id as league_id,
  l.name as league_name,
  l.created_by,
  COUNT(lm.user_id) as member_count
FROM leagues l
LEFT JOIN league_members lm ON l.id = lm.league_id
GROUP BY l.id, l.name, l.created_by
ORDER BY l.name;

-- 3. Check league_members table for all memberships
SELECT 
  lm.league_id,
  l.name as league_name,
  lm.user_id,
  p.username,
  lm.joined_at
FROM league_members lm
INNER JOIN leagues l ON lm.league_id = l.id
INNER JOIN profiles p ON lm.user_id = p.id
ORDER BY l.name, p.username;

-- 4. Check if profiles.active_league_id matches league_members
SELECT 
  p.id as user_id,
  p.username,
  p.active_league_id as profile_league,
  l.name as profile_league_name,
  COUNT(lm.league_id) as league_memberships,
  STRING_AGG(DISTINCT lm2.league_id::TEXT, ', ') as member_of_leagues
FROM profiles p
LEFT JOIN leagues l ON p.active_league_id = l.id
LEFT JOIN league_members lm ON p.id = lm.user_id
LEFT JOIN league_members lm2 ON p.id = lm2.user_id
GROUP BY p.id, p.username, p.active_league_id, l.name
ORDER BY p.username;

-- 5. Get The American Express tournament ID
SELECT id, name, status, start_date 
FROM tournaments 
WHERE name LIKE '%American Express%'
ORDER BY start_date DESC
LIMIT 1;

-- 6. Check ALL rosters for The American Express (bypassing RLS if run as service role)
-- NOTE: Replace with actual tournament ID from query 5
WITH tournament_id AS (
  SELECT id FROM tournaments WHERE name LIKE '%American Express%' ORDER BY start_date DESC LIMIT 1
)
SELECT 
  ur.id as roster_id,
  ur.roster_name,
  ur.user_id,
  p.username,
  p.active_league_id,
  l.name as user_league_name,
  ur.total_winnings,
  ur.created_at
FROM user_rosters ur
INNER JOIN profiles p ON ur.user_id = p.id
LEFT JOIN leagues l ON p.active_league_id = l.id
WHERE ur.tournament_id = (SELECT id FROM tournament_id)
ORDER BY ur.total_winnings DESC;

-- 7. Check RLS policies on user_rosters
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_rosters'
ORDER BY policyname;

-- 8. Check RLS policies on profiles
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- 9. Simulate the standings query for a specific user
-- Replace 'REPLACE_WITH_USER_ID' with an actual user ID from query 1
DO $$
DECLARE
  test_user_id UUID;
  test_league_id UUID;
  tournament_id UUID;
BEGIN
  -- Get first user with a league
  SELECT id, active_league_id INTO test_user_id, test_league_id
  FROM profiles
  WHERE active_league_id IS NOT NULL
  LIMIT 1;
  
  -- Get The American Express tournament
  SELECT id INTO tournament_id
  FROM tournaments
  WHERE name LIKE '%American Express%'
  ORDER BY start_date DESC
  LIMIT 1;
  
  IF test_user_id IS NOT NULL AND tournament_id IS NOT NULL THEN
    RAISE NOTICE 'Testing for user: %, league: %, tournament: %', test_user_id, test_league_id, tournament_id;
    
    -- This query simulates what the standings page does
    RAISE NOTICE 'Rosters that would be visible:';
    PERFORM ur.id, ur.roster_name, p.username
    FROM user_rosters ur
    INNER JOIN profiles p ON ur.user_id = p.id
    WHERE ur.tournament_id = tournament_id
    AND p.active_league_id = test_league_id;
  ELSE
    RAISE NOTICE 'Could not find test data';
  END IF;
END $$;
