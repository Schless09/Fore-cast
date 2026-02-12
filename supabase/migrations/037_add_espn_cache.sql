-- ESPN cache table for comparing vs RapidAPI (live_scores_cache)
-- Fetched from https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard

CREATE TABLE IF NOT EXISTS espn_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key VARCHAR(100) UNIQUE NOT NULL,  -- e.g., "espn-401811932"
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  tournament_status VARCHAR(50),
  current_round INTEGER,
  player_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_espn_cache_key ON espn_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_espn_cache_tournament ON espn_cache(tournament_id);

ALTER TABLE espn_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read espn_cache"
  ON espn_cache FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage espn_cache"
  ON espn_cache FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_espn_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS espn_cache_updated_at ON espn_cache;
CREATE TRIGGER espn_cache_updated_at
  BEFORE UPDATE ON espn_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_espn_cache_updated_at();

-- Add espn_event_id to tournaments for mapping (e.g. AT&T Pebble Beach = 401811932)
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS espn_event_id TEXT;

COMMENT ON TABLE espn_cache IS 'ESPN leaderboard cache for comparison with RapidAPI';
COMMENT ON COLUMN tournaments.espn_event_id IS 'ESPN event ID for scoreboard (e.g. 401811932 for AT&T Pebble Beach)';
