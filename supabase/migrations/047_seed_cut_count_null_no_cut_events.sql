-- No-cut events: Signature events (RBC Heritage, Cadillac, Truist, Travelers)
-- and FedEx Cup Playoffs (St. Jude, BMW, Tour Championship)
UPDATE tournaments
SET cut_count = NULL
WHERE (
  name ILIKE '%RBC Heritage%'
  OR name ILIKE '%Cadillac Championship%'
  OR name ILIKE '%Truist Championship%'
  OR name ILIKE '%Travelers Championship%'
  OR name ILIKE '%FedEx St. Jude Championship%'
  OR name ILIKE '%BMW Championship%'
  OR name ILIKE '%Tour Championship%'
);
