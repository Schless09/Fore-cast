-- Seed espn_event_id for AT&T Pebble Beach Pro-Am (tomorrow's test)
UPDATE tournaments
SET espn_event_id = '401811932'
WHERE name ILIKE '%Pebble Beach%'
  AND start_date >= '2026-02-12'
  AND start_date <= '2026-02-15';
