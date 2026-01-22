-- Add prize money distribution system
-- Run this in your Supabase SQL Editor

-- Table: prize_money_distributions
-- Stores the prize money payout structure for each tournament
CREATE TABLE IF NOT EXISTS prize_money_distributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  total_purse DECIMAL(12,2) NOT NULL,
  position INTEGER NOT NULL,
  percentage DECIMAL(5,2), -- Percentage of purse (e.g., 18.00 for 18%)
  amount DECIMAL(12,2) NOT NULL, -- Actual dollar amount
  -- Tie handling: if 2 players tie for position N, they split positions N and N+1
  -- This table stores the base amount, tie calculations happen in code
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, position)
);

-- RLS Policies for prize_money_distributions
ALTER TABLE prize_money_distributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view prize money distributions"
  ON prize_money_distributions FOR SELECT
  TO authenticated
  USING (true);

-- Add winnings fields to tournament_players
ALTER TABLE tournament_players 
ADD COLUMN IF NOT EXISTS prize_money DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_tied BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tied_with_count INTEGER DEFAULT 1; -- How many players tied at this position

-- Add total_winnings to user_rosters (replaces or supplements total_fantasy_points)
ALTER TABLE user_rosters
ADD COLUMN IF NOT EXISTS total_winnings DECIMAL(12,2) DEFAULT 0;

-- Add winnings to roster_players
ALTER TABLE roster_players
ADD COLUMN IF NOT EXISTS player_winnings DECIMAL(12,2) DEFAULT 0;

-- Index for prize money queries
CREATE INDEX IF NOT EXISTS idx_prize_money_tournament ON prize_money_distributions(tournament_id, position);
CREATE INDEX IF NOT EXISTS idx_tournament_players_winnings ON tournament_players(tournament_id, prize_money);

-- Comments
COMMENT ON COLUMN prize_money_distributions.total_purse IS 'Total tournament purse in dollars';
COMMENT ON COLUMN prize_money_distributions.percentage IS 'Percentage of purse for this position';
COMMENT ON COLUMN prize_money_distributions.amount IS 'Base amount for this position (before tie adjustments)';
COMMENT ON COLUMN tournament_players.prize_money IS 'Actual prize money earned by this player';
COMMENT ON COLUMN tournament_players.is_tied IS 'Whether this player is tied with others at their position';
COMMENT ON COLUMN tournament_players.tied_with_count IS 'Number of players tied at this position';
COMMENT ON COLUMN user_rosters.total_winnings IS 'Total prize money earned by all players in this roster';
COMMENT ON COLUMN roster_players.player_winnings IS 'Prize money earned by this specific player';
