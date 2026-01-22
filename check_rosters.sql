-- Diagnostic script to check rosters for The American Express tournament

-- 1. Get the tournament ID for "The American Express"
SELECT id, name, status, start_date, end_date
FROM tournaments
WHERE name LIKE '%American Express%'
ORDER BY start_date DESC
LIMIT 1;

-- 2. Check all users and their league assignments
SELECT 
  p.id,
  p.username,
  p.active_league_id,
  l.name as league_name
FROM profiles p
LEFT JOIN leagues l ON p.active_league_id = l.id
ORDER BY p.username;

-- 3. Check rosters for The American Express (replace TOURNAMENT_ID with actual ID from query 1)
-- IMPORTANT: Replace 'YOUR_TOURNAMENT_ID_HERE' with the actual tournament ID from query 1
SELECT 
  ur.id,
  ur.roster_name,
  ur.total_winnings,
  p.username,
  p.active_league_id,
  l.name as league_name,
  ur.tournament_id
FROM user_rosters ur
INNER JOIN profiles p ON ur.user_id = p.id
LEFT JOIN leagues l ON p.active_league_id = l.id
WHERE ur.tournament_id = 'YOUR_TOURNAMENT_ID_HERE'  -- Replace this with actual tournament ID
ORDER BY ur.total_winnings DESC;

-- 4. Count rosters per user for this tournament
-- IMPORTANT: Replace 'YOUR_TOURNAMENT_ID_HERE' with the actual tournament ID from query 1
SELECT 
  p.username,
  p.active_league_id,
  l.name as league_name,
  COUNT(ur.id) as roster_count
FROM profiles p
LEFT JOIN user_rosters ur ON p.id = ur.user_id AND ur.tournament_id = 'YOUR_TOURNAMENT_ID_HERE'  -- Replace this
LEFT JOIN leagues l ON p.active_league_id = l.id
GROUP BY p.id, p.username, p.active_league_id, l.name
ORDER BY p.username;

-- 5. Check if there are ANY rosters for this tournament
-- IMPORTANT: Replace 'YOUR_TOURNAMENT_ID_HERE' with the actual tournament ID from query 1
SELECT COUNT(*) as total_rosters
FROM user_rosters
WHERE tournament_id = 'YOUR_TOURNAMENT_ID_HERE';  -- Replace this
