-- Freeze player cost at roster save time so admin cost/odds updates don't change existing rosters
ALTER TABLE roster_players
ADD COLUMN IF NOT EXISTS player_cost DECIMAL(5,2);

COMMENT ON COLUMN roster_players.player_cost IS 'Player cost (salary) at time of pick; used for display and validation so roster total does not change when tournament_players.cost is updated later.';

-- Backfill: set player_cost from current tournament_players.cost so existing rosters are frozen at current values
UPDATE roster_players rp
SET player_cost = tp.cost
FROM tournament_players tp
WHERE rp.tournament_player_id = tp.id
  AND rp.player_cost IS NULL
  AND tp.cost IS NOT NULL;
