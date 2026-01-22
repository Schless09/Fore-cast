# League System Guide

## Overview

The league system allows multiple friend groups to run separate competitions. Users must join a league when they sign up, and all standings are filtered to only show users from the same league.

## Quick Start

### 1. Run the Migration

First, apply the database migration to create the leagues table:

```bash
# If using Supabase CLI (local development)
npx supabase migration up

# Or apply directly in Supabase Dashboard:
# Go to SQL Editor and run: supabase/migrations/010_add_leagues.sql
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

**profiles table (updated):**
- Added `league_id` - Foreign key to leagues table
- Users belong to one league

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

- **RLS Policies**: Users can view any league name (for joining) but only see their own league membership
- **Standalone Leaderboards**: Each league is completely isolated
- **No Cross-League Visibility**: Users can't see rosters or standings from other leagues

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

- Dashboard shows league badge in top-right corner
- All standings automatically filtered to show only league members
- No changes needed - users already in "BamaBoys2026"

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
SELECT p.id, p.username, p.email, l.name as league_name
FROM profiles p
JOIN leagues l ON p.league_id = l.id
WHERE l.name = 'BamaBoys2026';
```

### Move User to Different League

```sql
UPDATE profiles
SET league_id = (SELECT id FROM leagues WHERE name = 'NewLeagueName')
WHERE id = 'user-uuid-here';
```

### Delete a League

```sql
-- First, move or delete users from the league
UPDATE profiles SET league_id = NULL WHERE league_id = 'league-uuid';

-- Then delete the league
DELETE FROM leagues WHERE id = 'league-uuid';
```

## Future Enhancements

Potential improvements for the league system:

- [x] League creation UI ✅ (Completed)
- [ ] League admin dashboard
- [ ] Invite-only leagues (remove password requirement)
- [ ] League settings (buy-in amount, payout structure)
- [ ] Cross-league challenges
- [ ] League chat/comments
- [ ] League statistics and analytics
- [ ] League member list/management
- [ ] Password reset/change functionality

## Support

For issues or questions about the league system, check:
1. Database logs in Supabase Dashboard
2. Browser console for client-side errors
3. Server logs for API/server action errors
