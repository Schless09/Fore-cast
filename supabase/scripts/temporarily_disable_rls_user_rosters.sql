-- TEMPORARY: Disable RLS on user_rosters to test if that's the issue
-- This is JUST for debugging - DO NOT leave this in production!

-- Disable RLS temporarily
ALTER TABLE user_rosters DISABLE ROW LEVEL SECURITY;
ALTER TABLE roster_players DISABLE ROW LEVEL SECURITY;

-- Try creating a roster now in the app
-- If it works, the issue is with the RLS policies

-- After testing, RE-ENABLE RLS:
-- ALTER TABLE user_rosters ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE roster_players ENABLE ROW LEVEL SECURITY;

-- Then we need to fix the policies properly
