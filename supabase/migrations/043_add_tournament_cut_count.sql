-- Add cut_count to tournaments for projected cut calculation
-- PGA Tour standard: 65. Signature events: 50. NULL defaults to 65 in code.
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS cut_count INTEGER DEFAULT 65;

COMMENT ON COLUMN tournaments.cut_count IS 'Projected cut: top N and ties (e.g. 65 for PGA Tour, 50 for Signature events)';
