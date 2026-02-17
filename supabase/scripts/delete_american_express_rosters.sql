-- Delete all rosters for The American Express tournament
-- This will allow all league members to create fresh lineups

-- Tournament ID: 6466ea54-5648-4fa6-aa0f-31b96e8ffbef (The American Express)

-- Step 1: Delete all roster_players for these rosters
-- This must be done first due to foreign key constraints
DELETE FROM roster_players
WHERE roster_id IN (
  SELECT id FROM user_rosters
  WHERE tournament_id = '6466ea54-5648-4fa6-aa0f-31b96e8ffbef'
);

-- Step 2: Delete all user_rosters for this tournament
DELETE FROM user_rosters
WHERE tournament_id = '6466ea54-5648-4fa6-aa0f-31b96e8ffbef';

-- Verify deletion
SELECT COUNT(*) as remaining_rosters
FROM user_rosters
WHERE tournament_id = '6466ea54-5648-4fa6-aa0f-31b96e8ffbef';

-- Should return 0 rosters
