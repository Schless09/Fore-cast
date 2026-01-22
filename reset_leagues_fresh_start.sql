-- Reset leagues and user data for fresh start
-- Choose Option 1 or Option 2 based on what you want

-- ===== OPTION 1: Delete BamaBoys2026 league but keep users =====
-- This removes the league but users stay in the system (without a league)

-- 1. Remove all league invites for this league
DELETE FROM league_invites 
WHERE league_id = 'd3ebdcc2-0585-4475-a67d-ccd14247142e';

-- 2. Remove all league memberships
DELETE FROM league_members 
WHERE league_id = 'd3ebdcc2-0585-4475-a67d-ccd14247142e';

-- 3. Update profiles to remove league associations
UPDATE profiles 
SET 
  active_league_id = NULL,
  league_id = NULL
WHERE active_league_id = 'd3ebdcc2-0585-4475-a67d-ccd14247142e'
   OR league_id = 'd3ebdcc2-0585-4475-a67d-ccd14247142e';

-- 4. Delete the league
DELETE FROM leagues 
WHERE id = 'd3ebdcc2-0585-4475-a67d-ccd14247142e';

-- Verify it's gone
SELECT * FROM leagues;
SELECT COUNT(*) as remaining_users FROM profiles;


-- ===== OPTION 2: Nuclear - Delete ALL leagues AND ALL users =====
-- WARNING: This deletes EVERYTHING. Use only if starting completely fresh.
-- Uncomment the lines below to use this option:

-- DELETE FROM league_invites;
-- DELETE FROM league_members;
-- DELETE FROM user_rosters;  -- Also delete all rosters
-- DELETE FROM profiles WHERE id != (SELECT id FROM profiles LIMIT 1); -- Keep one admin user
-- DELETE FROM leagues;

-- If you want to delete EVERYTHING including auth users:
-- This requires Supabase dashboard access or service role key
-- You'll need to manually delete users from Authentication > Users


-- ===== OPTION 3: Just reset league memberships but keep league =====
-- This keeps the league but removes all members
-- Uncomment to use:

-- DELETE FROM league_invites 
-- WHERE league_id = 'd3ebdcc2-0585-4475-a67d-ccd14247142e';
-- 
-- DELETE FROM league_members 
-- WHERE league_id = 'd3ebdcc2-0585-4475-a67d-ccd14247142e';
-- 
-- UPDATE profiles 
-- SET active_league_id = NULL
-- WHERE active_league_id = 'd3ebdcc2-0585-4475-a67d-ccd14247142e';


-- ===== After running, verify the cleanup =====
SELECT 
  'leagues' as table_name,
  COUNT(*) as count
FROM leagues
UNION ALL
SELECT 
  'league_members',
  COUNT(*)
FROM league_members
UNION ALL
SELECT 
  'profiles',
  COUNT(*)
FROM profiles
UNION ALL
SELECT 
  'user_rosters',
  COUNT(*)
FROM user_rosters;
