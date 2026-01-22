-- Change thru column from INTEGER to TEXT to support both hole numbers and tee times
-- Examples: "5" (through 5 holes), "18" (finished), "6:09 PM" (tee time for players who haven't started)

ALTER TABLE tournament_players 
ALTER COLUMN thru TYPE TEXT USING thru::TEXT;

-- Update the default value
ALTER TABLE tournament_players 
ALTER COLUMN thru SET DEFAULT '0';

-- Add a comment
COMMENT ON COLUMN tournament_players.thru IS 'Holes completed (e.g., "5", "18") or tee time for players who haven''t started (e.g., "6:09 PM")';
