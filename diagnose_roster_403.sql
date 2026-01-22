-- Comprehensive diagnostic for 403 Forbidden on user_rosters

-- 1. Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'user_rosters';

-- 2. List ALL policies on user_rosters (should show INSERT policy)
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
ORDER BY cmd;

-- 3. Check roster_players policies too
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
WHERE tablename = 'roster_players'
ORDER BY cmd;

-- 4. Try to manually insert a test roster (replace USER_ID with your actual ID)
-- Uncomment and replace USER_ID to test:
-- INSERT INTO user_rosters (user_id, tournament_id, roster_name, total_winnings)
-- VALUES (
--   'YOUR_USER_ID_HERE',
--   '6466ea54-5648-4fa6-aa0f-31b96e8ffbef',  -- The American Express tournament ID
--   'Test Roster',
--   0
-- )
-- RETURNING *;

-- 5. Check what user is currently authenticated
-- Run this in a separate query after authenticating in Supabase dashboard:
-- SELECT auth.uid(), auth.role();
