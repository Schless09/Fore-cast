-- Add round-specific tee times for rounds 1 and 2
-- These are uploaded weekly (Wednesdays) before each tournament

ALTER TABLE tournament_players
ADD COLUMN IF NOT EXISTS tee_time_r1 TEXT,
ADD COLUMN IF NOT EXISTS tee_time_r2 TEXT,
ADD COLUMN IF NOT EXISTS starting_tee_r1 INTEGER,
ADD COLUMN IF NOT EXISTS starting_tee_r2 INTEGER;

COMMENT ON COLUMN tournament_players.tee_time_r1 IS 'Round 1 tee time (e.g., 12:10 PM)';
COMMENT ON COLUMN tournament_players.tee_time_r2 IS 'Round 2 tee time (e.g., 1:16 PM)';
COMMENT ON COLUMN tournament_players.starting_tee_r1 IS 'Round 1 starting tee (1 or 10)';
COMMENT ON COLUMN tournament_players.starting_tee_r2 IS 'Round 2 starting tee (1 or 10)';
