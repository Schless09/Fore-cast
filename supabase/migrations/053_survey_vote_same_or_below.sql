-- Add third survey option: replace only with golfer at same price or immediately below
ALTER TABLE survey_votes
  DROP CONSTRAINT IF EXISTS survey_votes_vote_check;

ALTER TABLE survey_votes
  ADD CONSTRAINT survey_votes_vote_check
  CHECK (vote IN ('yes', 'no', 'same_or_below'));
