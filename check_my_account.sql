-- Quick diagnostic to check YOUR account's league status
-- Run this and replace 'your_email@example.com' with your actual email

-- Replace 'your_email@example.com' with your actual email address
DO $$
DECLARE
  my_email TEXT := 'your_email@example.com';  -- CHANGE THIS TO YOUR EMAIL
  my_user_id UUID;
  my_active_league_id UUID;
  my_league_name TEXT;
BEGIN
  -- Get your user ID and active league
  SELECT id, active_league_id INTO my_user_id, my_active_league_id
  FROM profiles
  WHERE email = my_email;
  
  IF my_user_id IS NULL THEN
    RAISE NOTICE 'User not found with email: %', my_email;
    RETURN;
  END IF;
  
  -- Get your active league name
  SELECT name INTO my_league_name
  FROM leagues
  WHERE id = my_active_league_id;
  
  RAISE NOTICE '=== YOUR ACCOUNT STATUS ===';
  RAISE NOTICE 'User ID: %', my_user_id;
  RAISE NOTICE 'Active League ID: %', COALESCE(my_active_league_id::TEXT, 'NULL (THIS IS THE PROBLEM!)');
  RAISE NOTICE 'Active League Name: %', COALESCE(my_league_name, 'None');
  
  -- Show which leagues you're a member of
  RAISE NOTICE '';
  RAISE NOTICE '=== LEAGUES YOU ARE A MEMBER OF ===';
  FOR my_league_name IN 
    SELECT l.name
    FROM league_members lm
    INNER JOIN leagues l ON lm.league_id = l.id
    WHERE lm.user_id = my_user_id
  LOOP
    RAISE NOTICE '- %', my_league_name;
  END LOOP;
END $$;

-- Or just run these queries directly:
-- 1. Check your profile (REPLACE EMAIL)
SELECT 
  p.id,
  p.username,
  p.email,
  p.active_league_id,
  l.name as active_league_name
FROM profiles p
LEFT JOIN leagues l ON p.active_league_id = l.id
WHERE p.email = 'your_email@example.com';  -- CHANGE THIS

-- 2. Check your league memberships (REPLACE EMAIL)
SELECT 
  l.id as league_id,
  l.name as league_name,
  lm.joined_at,
  lm.is_active
FROM league_members lm
INNER JOIN leagues l ON lm.league_id = l.id
INNER JOIN profiles p ON lm.user_id = p.id
WHERE p.email = 'your_email@example.com';  -- CHANGE THIS

-- 3. Quick fix if active_league_id is NULL (REPLACE EMAIL)
-- Uncomment this to fix it:
-- UPDATE profiles
-- SET active_league_id = (
--   SELECT league_id 
--   FROM league_members 
--   WHERE user_id = profiles.id 
--   LIMIT 1
-- )
-- WHERE email = 'your_email@example.com'  -- CHANGE THIS
-- AND active_league_id IS NULL;
