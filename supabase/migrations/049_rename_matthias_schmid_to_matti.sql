-- Rename Matthias Schmid to Matti Schmid in pga_players so ESPN sync matches
-- ESPN uses "Matti Schmid"; DB had "Matthias Schmid" causing $0 winnings on completion
UPDATE pga_players
SET name = 'Matti Schmid'
WHERE LOWER(name) = 'matthias schmid';
