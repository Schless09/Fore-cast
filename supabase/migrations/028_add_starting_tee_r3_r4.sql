-- Add starting_tee_r3 and starting_tee_r4 columns for weekend rounds
-- These indicate which tee the player starts on (1 or 10)

ALTER TABLE tournament_players 
ADD COLUMN IF NOT EXISTS starting_tee_r3 INTEGER,
ADD COLUMN IF NOT EXISTS starting_tee_r4 INTEGER;

-- Add comments for documentation
COMMENT ON COLUMN tournament_players.starting_tee_r3 IS 'Starting tee for Round 3 (1 or 10)';
COMMENT ON COLUMN tournament_players.starting_tee_r4 IS 'Starting tee for Round 4 (1 or 10)';
