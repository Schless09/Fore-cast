-- Seed espn_event_id for Cognizant Classic in The Palm Beaches (2026)
-- ESPN event 401811934; enables live leaderboard when tournament is active
UPDATE tournaments
SET espn_event_id = '401811934'
WHERE name ILIKE '%Cognizant%';
