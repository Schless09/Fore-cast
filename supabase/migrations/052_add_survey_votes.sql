-- Survey votes: one vote per user per survey (e.g. late-WD auto-replace)
CREATE TABLE IF NOT EXISTS survey_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  survey_slug TEXT NOT NULL,
  vote TEXT NOT NULL CHECK (vote IN ('yes', 'no')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, survey_slug)  -- one vote per user per survey
);

CREATE INDEX IF NOT EXISTS idx_survey_votes_survey_slug ON survey_votes(survey_slug);
CREATE INDEX IF NOT EXISTS idx_survey_votes_profile ON survey_votes(profile_id);

ALTER TABLE survey_votes ENABLE ROW LEVEL SECURITY;

-- Writes go through API (service role) only. Allow read so aggregates can be shown.
CREATE POLICY "Anyone can view survey votes"
  ON survey_votes FOR SELECT
  USING (true);

COMMENT ON TABLE survey_votes IS 'User votes on product surveys (e.g. late-WD auto-replace roster)';
