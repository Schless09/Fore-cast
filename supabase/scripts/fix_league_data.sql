-- Check current state of users and their league assignments
-- Run this in Supabase SQL Editor to diagnose the issue

-- 1. Check if active_league_id column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('league_id', 'active_league_id');

-- 2. Check current user league assignments
SELECT 
  p.id,
  p.username,
  p.league_id,
  p.active_league_id,
  l1.name as old_league_name,
  l2.name as active_league_name
FROM profiles p
LEFT JOIN leagues l1 ON p.league_id = l1.id
LEFT JOIN leagues l2 ON p.active_league_id = l2.id
ORDER BY p.username;

-- 3. Fix: Set active_league_id to league_id for users where it's NULL
UPDATE profiles
SET active_league_id = league_id
WHERE league_id IS NOT NULL AND active_league_id IS NULL;

-- 4. Verify the fix
SELECT 
  COUNT(*) as total_users,
  COUNT(active_league_id) as users_with_active_league,
  COUNT(league_id) as users_with_league_id
FROM profiles;

-- 5. Check league_members table exists
SELECT COUNT(*) as league_members_count
FROM league_members;

-- 6. If league_members is empty or doesn't exist, populate it
INSERT INTO league_members (user_id, league_id, is_active)
SELECT id, league_id, true
FROM profiles
WHERE league_id IS NOT NULL
ON CONFLICT (user_id, league_id) DO NOTHING;

-- 7. Final verification - show all users with their leagues
SELECT 
  p.username,
  l.name as active_league,
  COUNT(lm.id) as league_memberships
FROM profiles p
LEFT JOIN leagues l ON p.active_league_id = l.id
LEFT JOIN league_members lm ON p.id = lm.user_id
GROUP BY p.id, p.username, l.name
ORDER BY p.username;
