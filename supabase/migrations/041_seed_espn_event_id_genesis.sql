-- Seed espn_event_id for The Genesis Invitational (live leaderboard from ESPN)
UPDATE tournaments
SET espn_event_id = '401811933'
WHERE name ILIKE '%Genesis Invitational%'
  AND name NOT ILIKE '%Scottish%'
  AND start_date >= '2026-02-19'
  AND start_date <= '2026-02-22';
