-- Detailed diagnostic for roster visibility issue
-- All members created rosters but they're not showing in standings

-- 1. Find The American Express tournament
SELECT 'TOURNAMENT INFO' as section, id, name, status, start_date
FROM tournaments
WHERE name LIKE '%American Express%'
ORDER BY start_date DESC
LIMIT 1;

-- 2. Show ALL rosters for The American Express (no filtering)
-- Replace TOURNAMENT_ID below with the ID from query 1
WITH tournament_rosters AS (
  SELECT 
    ur.id as roster_id,
    ur.roster_name,
    ur.total_winnings,
    ur.user_id,
    ur.tournament_id,
    p.username,
    p.active_league_id,
    p.league_id as old_league_id,
    l.name as league_name
  FROM user_rosters ur
  INNER JOIN profiles p ON ur.user_id = p.id
  LEFT JOIN leagues l ON p.active_league_id = l.id
  WHERE ur.tournament_id = (
    SELECT id FROM tournaments 
    WHERE name LIKE '%American Express%' 
    ORDER BY start_date DESC 
    LIMIT 1
  )
)
SELECT 'ALL ROSTERS' as section, *
FROM tournament_rosters
ORDER BY total_winnings DESC;

-- 3. Show league assignments for all users
SELECT 
  'USER LEAGUE INFO' as section,
  p.username,
  p.active_league_id,
  p.league_id as old_league_id,
  l.name as active_league_name,
  l2.name as old_league_name
FROM profiles p
LEFT JOIN leagues l ON p.active_league_id = l.id
LEFT JOIN leagues l2 ON p.league_id = l2.id
ORDER BY p.username;

-- 4. Test the exact query logic used in the app
-- This simulates what the app does - pick a user and filter by their league
WITH user_league AS (
  SELECT active_league_id 
  FROM profiles 
  WHERE username = 'SCHLESS09'
)
SELECT 
  'FILTERED ROSTERS (SCHLESS09 perspective)' as section,
  ur.roster_name,
  p.username,
  p.active_league_id,
  l.name as league_name,
  ur.total_winnings
FROM user_rosters ur
INNER JOIN profiles p ON ur.user_id = p.id
LEFT JOIN leagues l ON p.active_league_id = l.id
WHERE ur.tournament_id = (
  SELECT id FROM tournaments 
  WHERE name LIKE '%American Express%' 
  ORDER BY start_date DESC 
  LIMIT 1
)
AND p.active_league_id = (SELECT active_league_id FROM user_league)
ORDER BY ur.total_winnings DESC;

-- 5. Count rosters by user
SELECT 
  'ROSTER COUNT BY USER' as section,
  p.username,
  COUNT(ur.id) as roster_count,
  p.active_league_id,
  l.name as league_name
FROM profiles p
LEFT JOIN user_rosters ur ON p.id = ur.user_id AND ur.tournament_id = (
  SELECT id FROM tournaments 
  WHERE name LIKE '%American Express%' 
  ORDER BY start_date DESC 
  LIMIT 1
)
LEFT JOIN leagues l ON p.active_league_id = l.id
GROUP BY p.username, p.active_league_id, l.name
ORDER BY p.username;
