-- Team co-members: a league member can invite another person to help manage their team (rosters).
-- Co-members can view and edit the owner's rosters for that league's tournaments.
-- Co-members are NOT league members -- they don't have their own team or appear in standings.
-- Only the team owner can add/remove co-members.

-- Table: team_co_members
CREATE TABLE IF NOT EXISTS team_co_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  co_member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(league_id, owner_id, co_member_id),
  CHECK (owner_id != co_member_id)
);

CREATE INDEX IF NOT EXISTS idx_team_co_members_league_owner ON team_co_members(league_id, owner_id);
CREATE INDEX IF NOT EXISTS idx_team_co_members_co_member ON team_co_members(co_member_id);

-- Enable RLS
ALTER TABLE team_co_members ENABLE ROW LEVEL SECURITY;

-- RLS policies: use service client for all operations (Clerk auth doesn't map to Supabase auth.uid())
-- Allow public read so the app can check co-membership
CREATE POLICY "Allow read access to team_co_members" ON team_co_members
  FOR SELECT USING (true);

COMMENT ON TABLE team_co_members IS 'Co-members who can view/edit the owner''s rosters in this league';
COMMENT ON COLUMN team_co_members.owner_id IS 'League member who owns the team';
COMMENT ON COLUMN team_co_members.co_member_id IS 'Person with access to the owner''s team (not necessarily a league member)';

-- Table: team_invites (invite links for co-member access)
CREATE TABLE IF NOT EXISTS team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,          -- NULL means never expires
  max_uses INTEGER DEFAULT 1,       -- Default: single use
  current_uses INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_team_invites_code ON team_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_team_invites_owner ON team_invites(league_id, owner_id);

-- Enable RLS
ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;

-- Allow public read for invite code lookups
CREATE POLICY "Allow read access to team_invites" ON team_invites
  FOR SELECT USING (true);

-- Reuse the existing generate_invite_code() function for team invites
-- (it generates unique 8-char alphanumeric codes and checks league_invites;
--  since team_invites codes are in a separate table, collisions are fine)

COMMENT ON TABLE team_invites IS 'Invite links for team co-member access';
COMMENT ON COLUMN team_invites.owner_id IS 'The team owner who created this invite';
COMMENT ON COLUMN team_invites.invite_code IS 'Unique 8-character code used in invite URLs';
COMMENT ON COLUMN team_invites.max_uses IS 'Maximum number of times this invite can be used. Default 1 (single use)';
COMMENT ON COLUMN team_invites.expires_at IS 'When this invite expires. NULL = never expires';
