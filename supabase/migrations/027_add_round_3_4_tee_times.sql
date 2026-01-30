-- Add tee_time_r3 and tee_time_r4 columns for weekend rounds
-- These are typically set after the cut is made on Friday

ALTER TABLE tournament_players 
ADD COLUMN IF NOT EXISTS tee_time_r3 TEXT,
ADD COLUMN IF NOT EXISTS tee_time_r4 TEXT;

-- Add comment for documentation
COMMENT ON COLUMN tournament_players.tee_time_r3 IS 'Round 3 (Saturday) tee time in EST, e.g. "8:30 AM"';
COMMENT ON COLUMN tournament_players.tee_time_r4 IS 'Round 4 (Sunday) tee time in EST, e.g. "10:15 AM"';
