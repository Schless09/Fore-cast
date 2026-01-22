-- Enforce one roster per user per tournament
-- First, remove any duplicate rosters (keeping the most recent one)
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, tournament_id 
      ORDER BY created_at DESC
    ) as rn
  FROM user_rosters
)
DELETE FROM user_rosters
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Add unique constraint
ALTER TABLE user_rosters
ADD CONSTRAINT user_rosters_user_tournament_unique 
UNIQUE (user_id, tournament_id);

-- Add comment
COMMENT ON CONSTRAINT user_rosters_user_tournament_unique ON user_rosters 
IS 'Each user can only have one roster per tournament';
