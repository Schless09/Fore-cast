-- Store ESPN athlete ID on pga_players for headshot lookups and to avoid re-matching by name.
-- image_url (existing) stores the headshot URL from ESPN CDN.
ALTER TABLE pga_players
  ADD COLUMN IF NOT EXISTS espn_athlete_id TEXT;

COMMENT ON COLUMN pga_players.espn_athlete_id IS 'ESPN athlete ID (e.g. 10140) for headshot and profile lookups. Used with sports.core.api.espn.com athlete API.';

CREATE INDEX IF NOT EXISTS idx_pga_players_espn_athlete_id ON pga_players(espn_athlete_id) WHERE espn_athlete_id IS NOT NULL;
