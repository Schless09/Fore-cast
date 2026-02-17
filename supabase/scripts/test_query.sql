-- Test query to check league filtering
SELECT ur.id, ur.roster_name, ur.total_winnings, ur.user_id,
       p.username, p.active_league_id
FROM user_rosters ur
JOIN profiles p ON ur.user_id = p.id
WHERE ur.tournament_id = '6466ea54-5648-4fa6-aa0f-31b96e8ffbef'
ORDER BY ur.total_winnings DESC;
