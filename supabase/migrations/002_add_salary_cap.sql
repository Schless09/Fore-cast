-- Add salary cap fields to tournament_players table
-- Run this in your Supabase SQL Editor after the initial schema

-- Add cost and odds fields to tournament_players
ALTER TABLE tournament_players 
ADD COLUMN IF NOT EXISTS cost DECIMAL(5,2) DEFAULT 0.20,
ADD COLUMN IF NOT EXISTS winner_odds INTEGER,
ADD COLUMN IF NOT EXISTS top5_odds INTEGER,
ADD COLUMN IF NOT EXISTS top10_odds INTEGER;

-- Update user_rosters to track budget spent
ALTER TABLE user_rosters
ADD COLUMN IF NOT EXISTS budget_spent DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_players INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS budget_limit DECIMAL(5,2) DEFAULT 30.00;

-- Add index for cost queries
CREATE INDEX IF NOT EXISTS idx_tournament_players_cost ON tournament_players(tournament_id, cost);

-- Comment
COMMENT ON COLUMN tournament_players.cost IS 'Player cost for salary cap (in dollars)';
COMMENT ON COLUMN tournament_players.winner_odds IS 'American odds for winner (e.g., +290, -145)';
COMMENT ON COLUMN tournament_players.top5_odds IS 'American odds for top 5 finish';
COMMENT ON COLUMN tournament_players.top10_odds IS 'American odds for top 10 finish';
COMMENT ON COLUMN user_rosters.budget_spent IS 'Total salary spent on roster';
COMMENT ON COLUMN user_rosters.max_players IS 'Maximum players allowed in roster';
COMMENT ON COLUMN user_rosters.budget_limit IS 'Salary cap budget limit';
