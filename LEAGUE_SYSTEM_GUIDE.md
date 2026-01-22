# League System Guide

## Overview

The league system allows multiple friend groups to run separate competitions. **Users can belong to multiple leagues simultaneously** and switch between them to view different standings. Each league maintains its own isolated leaderboard and prize structure.

## Quick Start

### 1. Run the Migrations

First, apply the database migrations to create the leagues system:

```bash
# If using Supabase CLI (local development)
npx supabase migration up

# Or apply directly in Supabase Dashboard:
# Go to SQL Editor and run: 
# - supabase/migrations/010_add_leagues.sql (initial league system)
# - supabase/migrations/011_multi_league_support.sql (multi-league support)
```

### 2. Default League

The migration automatically:
- Creates a league called **"BamaBoys2026"** with password **"Season7"**
- Assigns all existing users to this league
- New users will be prompted to join a league on first login

### 3. Test the Onboarding Flow

1. Create a new test user account
2. After signup, you'll see a "Join League" modal
3. Enter:
   - **League Name**: `BamaBoys2026`
   - **Password**: `Season7`
4. You'll be added to the league and can see the dashboard

## Creating Additional Leagues

### Option 1: Via UI (Recommended)

Users can create their own leagues directly from the onboarding modal:

1. When the "Join League" modal appears, click **"Don't have a league? Create one"**
2. Enter your desired league name (minimum 3 characters)
3. Set a password (minimum 4 characters)
4. Click "Create League"
5. Share the league name and password with your friends!

The system automatically:
- Validates the league name is unique
- Creates the league
- Adds you as the first member

### Option 2: Via SQL (Advanced)

For direct database access, run this SQL in Supabase:

```sql
INSERT INTO leagues (name, password) 
VALUES ('YourLeagueName', 'YourPassword');
```

Example:
```sql
-- Create a league for another friend group
INSERT INTO leagues (name, password) 
VALUES ('GolfBuddies2026', 'eagles123');
```

## How It Works

### Database Structure

**leagues table:**
- `id` - UUID primary key
- `name` - Unique league name
- `password` - League password (plain text for simplicity)
- `created_at`, `updated_at` - Timestamps

**league_members table (junction table):**
- `id` - UUID primary key
- `user_id` - Foreign key to profiles
- `league_id` - Foreign key to leagues
- `joined_at` - When user joined this league
- `is_active` - Whether this is the user's currently active league
- Unique constraint on (user_id, league_id)

**profiles table (updated):**
- `league_id` - Deprecated, kept for backward compatibility
- `active_league_id` - The league user is currently viewing
- Users can belong to multiple leagues via league_members table

### Standings Filtering

All standings pages now filter by the user's league:

1. **Weekly Standings** (`/standings/weekly/[tournamentId]`)
   - Shows only rosters from users in your league
   - Your rank is relative to your league members only

2. **Season Standings** (`/standings/season`)
   - Cumulative winnings filtered by league
   - Each league has its own season leaderboard

3. **Dashboard**
   - Shows your current league name
   - "The Money Board" iframe shows league-specific data

### Security & Privacy

- **RLS Policies**: Users can view any league name (for joining) but only manage their own league memberships
- **Standalone Leaderboards**: Each league is completely isolated
- **No Cross-League Visibility**: Users can't see rosters or standings from other leagues (only their active league)
- **Active League Context**: All standings automatically filtered by user's active league selection

## User Experience

### New User Flow

1. User signs up → Creates account
2. Redirected to dashboard
3. **"Join League" modal appears** (cannot be dismissed)
4. User can either:
   - **Join existing league**: Enter league name and password
   - **Create new league**: Click toggle link, set name and password
5. On success → Modal closes, dashboard loads with league data

**Creating a League:**
- Click "Don't have a league? Create one"
- Enter unique league name (3+ characters)
- Set password (4+ characters)
- Share credentials with friends
- You become the first member

**Joining a League:**
- Get league name and password from organizer
- Enter credentials in the join form
- Instantly added to the league standings

### Existing User Experience

- Dashboard shows active league badge in top-right corner
- All standings automatically filtered to show only active league members
- Navigate to /leagues to manage league memberships
- Switch between leagues to view different standings
- No changes needed for BamaBoys2026 members - already migrated

## Managing Multiple Leagues

### League Management Page

Access at `/leagues` or click "Leagues" in the navbar.

**Features:**
- View all leagues you're a member of
- See which league is currently active (⭐)
- Switch between leagues
- Leave leagues you no longer want to be in
- Create or join new leagues

**Switching Leagues:**
1. Go to `/leagues`
2. Click "Switch To" on any non-active league
3. All standings pages will now show that league's data
4. Your selection persists across sessions

**Leaving a League:**
1. Go to `/leagues`
2. Click "Leave" next to any league
3. Confirm the action (cannot be undone)
4. If you leave your active league, another league becomes active automatically

### Multi-League Benefits

- **Multiple Friend Groups**: Join different leagues for work, college friends, family, etc.
- **Separate Competitions**: Each league has its own leaderboard and prizes
- **Shared Rosters**: Your rosters are visible across all leagues
- **Easy Switching**: Toggle between leagues without losing data
- **Flexible Participation**: Join new leagues anytime, leave when you want

## Troubleshooting

### Modal doesn't appear for new users

Check that the migration ran successfully:
```sql
SELECT * FROM leagues WHERE name = 'BamaBoys2026';
```

### User can't join league

Common issues:
- League name is case-sensitive
- Password must match exactly
- User may already be in a league (check profiles table)

### Standings show wrong users

Verify the user's league assignment:
```sql
SELECT u.email, p.league_id, l.name as league_name
FROM auth.users u
JOIN profiles p ON u.id = p.id
LEFT JOIN leagues l ON p.league_id = l.id
WHERE u.email = 'user@example.com';
```

## Managing Leagues

### View All Leagues

```sql
SELECT * FROM leagues ORDER BY created_at DESC;
```

### View Users in a League

```sql
SELECT p.id, p.username, u.email, l.name as league_name, lm.joined_at
FROM league_members lm
JOIN profiles p ON lm.user_id = p.id
JOIN auth.users u ON p.id = u.id
JOIN leagues l ON lm.league_id = l.id
WHERE l.name = 'BamaBoys2026'
ORDER BY lm.joined_at DESC;
```

### View All Leagues a User Belongs To

```sql
SELECT l.name as league_name, lm.joined_at, 
       (p.active_league_id = l.id) as is_active
FROM league_members lm
JOIN leagues l ON lm.league_id = l.id
JOIN profiles p ON lm.user_id = p.id
WHERE p.id = 'user-uuid-here'
ORDER BY lm.joined_at DESC;
```

### Add User to Another League (manually)

```sql
-- Add user to a new league
INSERT INTO league_members (user_id, league_id)
VALUES ('user-uuid-here', (SELECT id FROM leagues WHERE name = 'NewLeagueName'))
ON CONFLICT (user_id, league_id) DO NOTHING;

-- Optionally set it as their active league
UPDATE profiles
SET active_league_id = (SELECT id FROM leagues WHERE name = 'NewLeagueName')
WHERE id = 'user-uuid-here';
```

### Remove User from a League

```sql
DELETE FROM league_members
WHERE user_id = 'user-uuid-here' 
  AND league_id = (SELECT id FROM leagues WHERE name = 'LeagueName');
```

### Delete a League

```sql
-- First, remove all members (CASCADE will handle this automatically)
-- Just delete the league - league_members will cascade delete
DELETE FROM leagues WHERE id = 'league-uuid';

-- Or by name:
DELETE FROM leagues WHERE name = 'LeagueName';
```

## Future Enhancements

Potential improvements for the league system:

- [x] League creation UI ✅ (Completed)
- [x] Multi-league support ✅ (Completed)
- [x] League switching ✅ (Completed)
- [x] League management page ✅ (Completed)
- [ ] League admin dashboard (assign commissioners)
- [ ] Invite-only leagues (remove password requirement)
- [ ] League settings (buy-in amount, payout structure)
- [ ] Cross-league challenges
- [ ] League chat/comments
- [ ] League statistics and analytics
- [ ] League member list with roles
- [ ] Password reset/change functionality
- [ ] League join notifications
- [ ] Export league standings to CSV

## Support

For issues or questions about the league system, check:
1. Database logs in Supabase Dashboard
2. Browser console for client-side errors
3. Server logs for API/server action errors
