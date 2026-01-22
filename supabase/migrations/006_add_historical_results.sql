-- Add historical tournament results for player stats
CREATE TABLE IF NOT EXISTS historical_tournament_results (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  pga_player_id UUID NOT NULL REFERENCES pga_players(id) ON DELETE CASCADE,
  tournament_name TEXT NOT NULL,
  course_name TEXT NULL,
  venue_id TEXT NULL, -- Identifier for grouping by venue (e.g., "waialae-cc", "torrey-pines")
  tournament_date DATE NOT NULL,
  finish_position INTEGER NULL,
  is_made_cut BOOLEAN DEFAULT TRUE,
  total_score INTEGER NULL,
  strokes_gained_total DECIMAL(10,2) NULL,
  strokes_gained_putting DECIMAL(10,2) NULL,
  strokes_gained_approach DECIMAL(10,2) NULL,
  strokes_gained_around_green DECIMAL(10,2) NULL,
  strokes_gained_off_tee DECIMAL(10,2) NULL,
  prize_money DECIMAL(12,2) NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT historical_tournament_results_unique UNIQUE (pga_player_id, tournament_name, tournament_date)
);

-- Indexes for performance
CREATE INDEX idx_historical_results_player ON historical_tournament_results(pga_player_id);
CREATE INDEX idx_historical_results_date ON historical_tournament_results(tournament_date DESC);
CREATE INDEX idx_historical_results_venue ON historical_tournament_results(venue_id);
CREATE INDEX idx_historical_results_player_venue ON historical_tournament_results(pga_player_id, venue_id);

-- RLS Policies (read-only for all authenticated users)
ALTER TABLE historical_tournament_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Historical results are viewable by all authenticated users"
  ON historical_tournament_results
  FOR SELECT
  TO authenticated
  USING (true);

-- Comments
COMMENT ON TABLE historical_tournament_results IS 'Historical tournament performance data for player stats and analysis';
COMMENT ON COLUMN historical_tournament_results.venue_id IS 'Standardized venue identifier for grouping tournaments at same course';
COMMENT ON COLUMN historical_tournament_results.strokes_gained_total IS 'Total strokes gained vs field';
