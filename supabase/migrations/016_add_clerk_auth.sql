-- Migration: Add Clerk authentication support
-- This migration modifies the profiles table to support Clerk user IDs
-- instead of Supabase auth.users

-- Add clerk_id column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS clerk_id TEXT UNIQUE;

-- Create index for fast lookups by clerk_id
CREATE INDEX IF NOT EXISTS idx_profiles_clerk_id ON public.profiles(clerk_id);

-- Make the id column have a default UUID (no longer tied to auth.users)
-- For new Clerk users, we'll generate a UUID
ALTER TABLE public.profiles 
ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Drop the foreign key constraint to auth.users if it exists
-- (This allows profiles to exist without a corresponding auth.users row)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_id_fkey' 
    AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey;
  END IF;
END $$;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
-- Since we're using Clerk for auth (not Supabase Auth), we can't use auth.uid()
-- in RLS policies. Instead:
-- 
-- 1. Server-side code uses SERVICE ROLE which bypasses RLS entirely
-- 2. Client-side code (anon key) gets READ-ONLY access to non-sensitive data
-- 3. All WRITES must go through server actions (which use service role)
-- ============================================================================

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "League members can view profiles in their league" ON public.profiles;

-- Allow anyone to read profiles (usernames are public in leaderboards)
CREATE POLICY "Anyone can view profiles"
  ON public.profiles
  FOR SELECT
  USING (true);

-- No insert/update/delete via anon key - must use service role

-- ============================================================================
-- USER_ROSTERS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view rosters in their league" ON public.user_rosters;
DROP POLICY IF EXISTS "Users can insert own roster" ON public.user_rosters;
DROP POLICY IF EXISTS "Users can update own roster" ON public.user_rosters;
DROP POLICY IF EXISTS "Users can delete own roster" ON public.user_rosters;

-- Allow anyone to read rosters (needed for leaderboards)
CREATE POLICY "Anyone can view rosters"
  ON public.user_rosters
  FOR SELECT
  USING (true);

-- No insert/update/delete via anon key - must use service role

-- ============================================================================
-- LEAGUE_MEMBERS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own league memberships" ON public.league_members;
DROP POLICY IF EXISTS "Users can insert own league membership" ON public.league_members;
DROP POLICY IF EXISTS "Users can update own league membership" ON public.league_members;

-- Allow anyone to read league memberships (needed to filter leaderboards by league)
CREATE POLICY "Anyone can view league members"
  ON public.league_members
  FOR SELECT
  USING (true);

-- No insert/update/delete via anon key - must use service role

-- ============================================================================
-- LEAGUE_INVITES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "League members can view their league invites" ON public.league_invites;
DROP POLICY IF EXISTS "League members can create invites" ON public.league_invites;
DROP POLICY IF EXISTS "Invite creators can update their invites" ON public.league_invites;
DROP POLICY IF EXISTS "Invite creators can delete their invites" ON public.league_invites;
DROP POLICY IF EXISTS "Anyone can view active invites" ON public.league_invites;

-- Allow reading active invites (needed for invite link flow)
CREATE POLICY "Anyone can view active invites"
  ON public.league_invites
  FOR SELECT
  USING (is_active = true);

-- No insert/update/delete via anon key - must use service role

-- ============================================================================
-- LEAGUES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can create leagues" ON public.leagues;
DROP POLICY IF EXISTS "Everyone can view league names" ON public.leagues;

-- Allow anyone to read league names (public info)
CREATE POLICY "Anyone can view leagues"
  ON public.leagues
  FOR SELECT
  USING (true);

-- No insert/update/delete via anon key - must use service role

-- ============================================================================
-- ROSTER_PLAYERS TABLE (if exists)
-- ============================================================================
DROP POLICY IF EXISTS "Users can view roster players" ON public.roster_players;
DROP POLICY IF EXISTS "Users can insert roster players" ON public.roster_players;
DROP POLICY IF EXISTS "Users can delete roster players" ON public.roster_players;

-- Allow anyone to read roster players (needed for displaying rosters)
CREATE POLICY "Anyone can view roster players"
  ON public.roster_players
  FOR SELECT
  USING (true);

-- No insert/update/delete via anon key - must use service role
