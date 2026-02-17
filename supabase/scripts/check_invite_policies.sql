-- Check if RLS is enabled on the tables
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('league_invites', 'leagues')
  AND schemaname = 'public';

-- Check existing policies on league_invites
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'league_invites';

-- Check existing policies on leagues
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'leagues';

-- Test if we can read league invites as anon
SELECT 
  invite_code,
  league_id,
  is_active
FROM league_invites
WHERE is_active = true
LIMIT 5;

-- Test if we can read leagues as anon
SELECT 
  id,
  name
FROM leagues
LIMIT 5;
