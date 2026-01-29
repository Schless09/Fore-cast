-- Enhancement: Custom segment names and multiple segments per tournament

-- 1. Create league_segments table for custom segment names
CREATE TABLE IF NOT EXISTS league_segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  segment_number INTEGER NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(league_id, segment_number)
);

-- RLS for league_segments
ALTER TABLE league_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view league segments"
  ON league_segments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Commissioner can insert league segments"
  ON league_segments FOR INSERT
  TO authenticated
  WITH CHECK (
    league_id IN (
      SELECT id FROM leagues WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Commissioner can update league segments"
  ON league_segments FOR UPDATE
  TO authenticated
  USING (
    league_id IN (
      SELECT id FROM leagues WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Commissioner can delete league segments"
  ON league_segments FOR DELETE
  TO authenticated
  USING (
    league_id IN (
      SELECT id FROM leagues WHERE created_by = auth.uid()
    )
  );

CREATE INDEX idx_league_segments_league ON league_segments(league_id);

-- 2. Add segments array column to league_tournaments (replacing single segment)
ALTER TABLE league_tournaments 
ADD COLUMN segments INTEGER[] DEFAULT '{}';

-- 3. Migrate existing data: copy segment to segments array
UPDATE league_tournaments 
SET segments = ARRAY[segment] 
WHERE segment IS NOT NULL;

-- 4. Drop old segment column and index
DROP INDEX IF EXISTS idx_league_tournaments_segment;
ALTER TABLE league_tournaments DROP COLUMN segment;

-- 5. Create new index for array searching
CREATE INDEX idx_league_tournaments_segments ON league_tournaments USING GIN(segments);

-- Comments
COMMENT ON TABLE league_segments IS 'Custom segment names for each league (e.g., 1st Half, Playoffs)';
COMMENT ON COLUMN league_segments.segment_number IS 'The segment number (1, 2, 3...) this name applies to';
COMMENT ON COLUMN league_segments.name IS 'Custom display name for this segment';
COMMENT ON COLUMN league_tournaments.segments IS 'Array of segment numbers this tournament belongs to. Empty array means all segments (Full Season only).';
