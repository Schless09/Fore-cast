-- Add is_amateur column to pga_players (not tournament_players)
-- Amateurs cannot collect prize money; their prize money moves down to pros below them
-- This is a player attribute, not tournament-specific

ALTER TABLE pga_players
ADD COLUMN IF NOT EXISTS is_amateur BOOLEAN NOT NULL DEFAULT false;

-- Add comment explaining the column
COMMENT ON COLUMN pga_players.is_amateur IS 'Whether the player is an amateur. Amateurs cannot collect prize money - it redistributes to professionals below them.';
