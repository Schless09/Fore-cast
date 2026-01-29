-- Junction table for league tournament selection
-- Allows commissioners to customize which tournaments are included in their league
-- and assign them to numbered segments for season standings

CREATE TABLE IF NOT EXISTS league_tournaments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  segment INTEGER NULL,  -- 1, 2, 3... or NULL for all segments
  is_excluded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(league_id, tournament_id)
);

-- RLS: Anyone can view, only commissioner can modify
ALTER TABLE league_tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view league tournaments"
  ON league_tournaments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Commissioner can insert league tournaments"
  ON league_tournaments FOR INSERT
  TO authenticated
  WITH CHECK (
    league_id IN (
      SELECT id FROM leagues WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Commissioner can update league tournaments"
  ON league_tournaments FOR UPDATE
  TO authenticated
  USING (
    league_id IN (
      SELECT id FROM leagues WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Commissioner can delete league tournaments"
  ON league_tournaments FOR DELETE
  TO authenticated
  USING (
    league_id IN (
      SELECT id FROM leagues WHERE created_by = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX idx_league_tournaments_league ON league_tournaments(league_id);
CREATE INDEX idx_league_tournaments_tournament ON league_tournaments(tournament_id);
CREATE INDEX idx_league_tournaments_segment ON league_tournaments(league_id, segment);

-- Comments
COMMENT ON TABLE league_tournaments IS 'Junction table for league-specific tournament selection and segment assignment';
COMMENT ON COLUMN league_tournaments.segment IS 'Numbered segment (1, 2, 3...) for season standings. NULL means included in all segments.';
COMMENT ON COLUMN league_tournaments.is_excluded IS 'If true, tournament is excluded from this league entirely';
