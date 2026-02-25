-- Add withdrawn status for pre-tournament WDs
-- When true: show "WD" instead of cost, strikethrough, not selectable; email affected roster owners

ALTER TABLE tournament_players
ADD COLUMN IF NOT EXISTS withdrawn BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tournament_players_withdrawn
ON tournament_players(tournament_id, withdrawn)
WHERE withdrawn = true;

COMMENT ON COLUMN tournament_players.withdrawn IS 'Player withdrew before tournament start; show WD in UI, notify roster owners';
