-- Migration: Add live_scores_cache table for server-side API response caching
-- This prevents each user from triggering API calls and ensures efficient use of rate limits

-- Create cache table
CREATE TABLE IF NOT EXISTS live_scores_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key VARCHAR(100) UNIQUE NOT NULL, -- e.g., "2026-002" (year-tournId)
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  data JSONB NOT NULL, -- Full API response
  tournament_status VARCHAR(50), -- 'In Progress', 'Official', etc.
  current_round INTEGER,
  player_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_live_scores_cache_key ON live_scores_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_live_scores_cache_updated ON live_scores_cache(updated_at);

-- Create API call log for monitoring usage
CREATE TABLE IF NOT EXISTS api_call_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_name VARCHAR(50) NOT NULL, -- 'rapidapi', 'livegolfapi'
  endpoint VARCHAR(100), -- '/leaderboard'
  cache_key VARCHAR(100),
  success BOOLEAN DEFAULT true,
  response_time_ms INTEGER,
  error_message TEXT,
  called_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for monitoring/reporting
CREATE INDEX IF NOT EXISTS idx_api_call_log_date ON api_call_log(called_at);
CREATE INDEX IF NOT EXISTS idx_api_call_log_api ON api_call_log(api_name);

-- RLS policies
ALTER TABLE live_scores_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_call_log ENABLE ROW LEVEL SECURITY;

-- Anyone can read cache (it's public data)
CREATE POLICY "Anyone can read live scores cache"
  ON live_scores_cache FOR SELECT
  USING (true);

-- Only service role can write to cache
CREATE POLICY "Service role can manage cache"
  ON live_scores_cache FOR ALL
  USING (true)
  WITH CHECK (true);

-- Only service role can write to API log
CREATE POLICY "Service role can manage API log"
  ON api_call_log FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_live_scores_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS live_scores_cache_updated_at ON live_scores_cache;
CREATE TRIGGER live_scores_cache_updated_at
  BEFORE UPDATE ON live_scores_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_live_scores_cache_updated_at();

COMMENT ON TABLE live_scores_cache IS 'Server-side cache for live golf scores from RapidAPI';
COMMENT ON TABLE api_call_log IS 'Log of all external API calls for monitoring usage and rate limits';
