-- Store each player's cost in roster version snapshots (per-player, not just lineup total)
ALTER TABLE roster_version_players
ADD COLUMN IF NOT EXISTS player_cost DECIMAL(5,2);

COMMENT ON COLUMN roster_version_players.player_cost IS 'Player salary/cost at time of snapshot (per player). roster_versions.budget_spent remains the lineup total.';

-- Backfill from tournament_players.cost where missing
UPDATE roster_version_players rvp
SET player_cost = tp.cost
FROM tournament_players tp
WHERE rvp.tournament_player_id = tp.id
  AND rvp.player_cost IS NULL
  AND tp.cost IS NOT NULL;
