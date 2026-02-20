-- Genesis Invitational is a Signature event: Top 50 + ties (not standard 65)
UPDATE tournaments
SET cut_count = 50
WHERE name ILIKE '%Genesis Invitational%'
  AND name NOT ILIKE '%Scottish%'
  AND start_date >= '2026-02-19';
