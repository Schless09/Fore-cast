-- Fix RLS policies for PGA player and tournament data tables
-- These tables should be readable by all authenticated users

-- ===== PGA_PLAYERS TABLE =====
-- All users should be able to view player data

DROP POLICY IF EXISTS "Anyone can view players" ON pga_players;
DROP POLICY IF EXISTS "Users can view players" ON pga_players;
DROP POLICY IF EXISTS "Authenticated users can view players" ON pga_players;

CREATE POLICY "Authenticated users can view all players" ON pga_players
  FOR SELECT
  TO authenticated
  USING (true);

-- ===== TOURNAMENT_PLAYERS TABLE =====
-- All users should be able to view tournament player data (scores, positions, etc.)

DROP POLICY IF EXISTS "Anyone can view tournament players" ON tournament_players;
DROP POLICY IF EXISTS "Users can view tournament players" ON tournament_players;
DROP POLICY IF EXISTS "Authenticated users can view tournament players" ON tournament_players;

CREATE POLICY "Authenticated users can view all tournament players" ON tournament_players
  FOR SELECT
  TO authenticated
  USING (true);

-- ===== HISTORICAL_TOURNAMENT_RESULTS TABLE =====
-- All users should be able to view historical results

DROP POLICY IF EXISTS "Anyone can view historical results" ON historical_tournament_results;
DROP POLICY IF EXISTS "Users can view historical results" ON historical_tournament_results;
DROP POLICY IF EXISTS "Authenticated users can view historical results" ON historical_tournament_results;

CREATE POLICY "Authenticated users can view all historical results" ON historical_tournament_results
  FOR SELECT
  TO authenticated
  USING (true);

-- ===== TOURNAMENTS TABLE =====
-- All users should be able to view tournament data

DROP POLICY IF EXISTS "Anyone can view tournaments" ON tournaments;
DROP POLICY IF EXISTS "Users can view tournaments" ON tournaments;
DROP POLICY IF EXISTS "Authenticated users can view tournaments" ON tournaments;

CREATE POLICY "Authenticated users can view all tournaments" ON tournaments
  FOR SELECT
  TO authenticated
  USING (true);

-- ===== VERIFY =====
SELECT 
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN ('pga_players', 'tournament_players', 'historical_tournament_results', 'tournaments')
AND cmd = 'SELECT'
ORDER BY tablename;
