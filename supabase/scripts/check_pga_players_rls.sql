-- Check RLS policies on pga_players and related tables

-- 1. Check if RLS is enabled on pga_players
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('pga_players', 'tournament_players', 'historical_tournament_results');

-- 2. View all policies on these tables
SELECT 
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('pga_players', 'tournament_players', 'historical_tournament_results')
ORDER BY tablename, cmd;
