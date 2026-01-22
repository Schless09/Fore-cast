-- Debug script for league creation issues

-- 1. Check if leagues table has RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'leagues';

-- 2. Check RLS policies on leagues table
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'leagues';

-- 3. Check if league_members RLS allows INSERT
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'league_members'
AND cmd = 'INSERT';

-- 4. Try to see if there are any existing leagues with similar names
SELECT id, name, created_at
FROM leagues
WHERE name ILIKE '%bama%';

-- 5. Check if your profile exists and has proper permissions
-- Replace USER_ID with your actual user ID
-- SELECT * FROM profiles WHERE id = 'YOUR_USER_ID';
