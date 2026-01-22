-- Add tee_time and starting_tee columns to tournament_players
-- These fields are populated from LiveGolfAPI round data

ALTER TABLE tournament_players
ADD COLUMN IF NOT EXISTS tee_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS starting_tee INTEGER;

-- Create index for faster queries on tee_time
CREATE INDEX IF NOT EXISTS idx_tournament_players_tee_time 
ON tournament_players(tournament_id, tee_time);

COMMENT ON COLUMN tournament_players.tee_time IS 'Tee time for current round from LiveGolfAPI';
COMMENT ON COLUMN tournament_players.starting_tee IS 'Starting tee (1 or 10) for current round';
