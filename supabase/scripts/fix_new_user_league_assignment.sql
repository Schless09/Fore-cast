-- Fix: New users aren't getting added to a league during signup
-- This causes them to be unable to see rosters due to RLS policies

-- ===== STEP 1: Create or verify default league exists =====
DO $$
DECLARE
  default_league_id UUID;
  first_user_id UUID;
BEGIN
  -- Get the first user to use as league creator
  SELECT id INTO first_user_id FROM profiles LIMIT 1;
  
  -- Check if "BamaBoys2026" league exists
  SELECT id INTO default_league_id
  FROM leagues
  WHERE name = 'BamaBoys2026'
  LIMIT 1;
  
  -- If not found, create it
  IF default_league_id IS NULL THEN
    INSERT INTO leagues (name, password, created_by)
    VALUES ('BamaBoys2026', 'Season7', first_user_id)
    RETURNING id INTO default_league_id;
    
    RAISE NOTICE 'Created default league: BamaBoys2026 with ID: %', default_league_id;
  ELSE
    RAISE NOTICE 'Default league already exists with ID: %', default_league_id;
  END IF;
END $$;

-- ===== STEP 2: Add created_by column to leagues if it doesn't exist =====
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leagues' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE leagues ADD COLUMN created_by UUID REFERENCES profiles(id);
    
    -- Set created_by to first user for existing leagues
    UPDATE leagues
    SET created_by = (SELECT id FROM profiles LIMIT 1)
    WHERE created_by IS NULL;
  END IF;
END $$;

-- ===== STEP 3: Backfill - Add all users without leagues to default league =====
DO $$
DECLARE
  default_league_id UUID;
  users_added INTEGER;
BEGIN
  -- Get the default league ID
  SELECT id INTO default_league_id
  FROM leagues
  WHERE name = 'BamaBoys2026'
  LIMIT 1;
  
  IF default_league_id IS NULL THEN
    RAISE EXCEPTION 'Default league not found!';
  END IF;
  
  -- Add users to league_members if they aren't in ANY league
  WITH users_without_league AS (
    SELECT p.id
    FROM profiles p
    WHERE NOT EXISTS (
      SELECT 1 FROM league_members lm WHERE lm.user_id = p.id
    )
  )
  INSERT INTO league_members (user_id, league_id, is_active)
  SELECT id, default_league_id, true
  FROM users_without_league
  ON CONFLICT (user_id, league_id) DO NOTHING;
  
  GET DIAGNOSTICS users_added = ROW_COUNT;
  RAISE NOTICE 'Added % users to league_members', users_added;
  
  -- Set active_league_id for users who don't have one
  UPDATE profiles
  SET active_league_id = default_league_id
  WHERE active_league_id IS NULL;
  
  RAISE NOTICE 'Updated active_league_id for users';
END $$;

-- ===== STEP 4: Update the handle_new_user trigger to auto-assign league =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_league_id UUID;
BEGIN
  -- Get the default league (BamaBoys2026)
  SELECT id INTO default_league_id
  FROM leagues
  WHERE name = 'BamaBoys2026'
  LIMIT 1;
  
  -- Create profile with active_league_id set
  INSERT INTO public.profiles (id, username, email, active_league_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.email,
    default_league_id  -- Set default league immediately
  );
  
  -- Add user to league_members table
  IF default_league_id IS NOT NULL THEN
    INSERT INTO league_members (user_id, league_id, is_active)
    VALUES (NEW.id, default_league_id, true)
    ON CONFLICT (user_id, league_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===== STEP 5: Verify the fix =====
-- Check all users now have active_league_id and are in league_members
SELECT 
  p.id,
  p.username,
  p.active_league_id,
  l.name as league_name,
  COUNT(lm.league_id) as league_memberships
FROM profiles p
LEFT JOIN leagues l ON p.active_league_id = l.id
LEFT JOIN league_members lm ON p.id = lm.user_id
GROUP BY p.id, p.username, p.active_league_id, l.name
ORDER BY p.username;

-- Check how many users are in each league
SELECT 
  l.id,
  l.name,
  COUNT(lm.user_id) as member_count
FROM leagues l
LEFT JOIN league_members lm ON l.id = lm.league_id
GROUP BY l.id, l.name
ORDER BY l.name;

RAISE NOTICE 'Fix complete! All new users will now be automatically added to the default league.';
