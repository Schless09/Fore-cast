-- Check if tee times exist in the database for The American Express
SELECT 
  tp.id,
  p.name,
  tp.tee_time,
  tp.starting_tee,
  tp.position,
  t.name as tournament_name,
  t.status
FROM tournament_players tp
JOIN pga_players p ON tp.pga_player_id = p.id
JOIN tournaments t ON tp.tournament_id = t.id
WHERE t.name LIKE '%American Express%'
AND tp.tee_time IS NOT NULL
LIMIT 10;
