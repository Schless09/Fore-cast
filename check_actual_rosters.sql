-- Direct check: What rosters ACTUALLY exist in user_rosters table
-- for The American Express tournament

-- Tournament ID from logs: 6466ea54-5648-4fa6-aa0f-31b96e8ffbef

SELECT 
  ur.id,
  ur.roster_name,
  ur.total_winnings,
  ur.user_id,
  p.username,
  p.active_league_id,
  l.name as league_name
FROM user_rosters ur
INNER JOIN profiles p ON ur.user_id = p.id
LEFT JOIN leagues l ON p.active_league_id = l.id
WHERE ur.tournament_id = '6466ea54-5648-4fa6-aa0f-31b96e8ffbef'
ORDER BY ur.total_winnings DESC;

-- Also check roster_players to see if players are assigned
SELECT 
  rp.id,
  ur.roster_name,
  p.username,
  tp.pga_player_id,
  pgap.name as player_name
FROM roster_players rp
INNER JOIN user_rosters ur ON rp.roster_id = ur.id
INNER JOIN profiles p ON ur.user_id = p.id
LEFT JOIN tournament_players tp ON rp.tournament_player_id = tp.id
LEFT JOIN pga_players pgap ON tp.pga_player_id = pgap.id
WHERE ur.tournament_id = '6466ea54-5648-4fa6-aa0f-31b96e8ffbef'
ORDER BY p.username, rp.id;
