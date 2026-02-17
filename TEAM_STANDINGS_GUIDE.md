# Team Standings - Winnings Calculation Guide

## Overview
Team Standings on the Weekly Standings page will display the **combined winnings** of all golfers selected by each member. Currently showing $0 because winnings haven't been calculated yet.

## How to Get Winnings to Show Up

### For Active/Completed Tournaments:

#### **Step 1: Import Prize Money Distribution**
Go to `/admin/prize-money`:
1. Select the tournament from dropdown
2. Paste the prize money JSON (position, percentage, amount)
3. Click "Import Prize Money"

Example format:
```json
[
  { "position": 1, "percentage": 18.0, "amount": 1566000 },
  { "position": 2, "percentage": 10.9, "amount": 948300 },
  ...
]
```

#### **Step 2: Sync scores (RapidAPI)**
Go to `/admin/scores`:
1. Select the tournament from the dropdown
2. Click "Sync Scores" (or "Sync from RapidAPI")

This will:
- Fetch leaderboard from RapidAPI (Live Golf Data) or use cached data
- Update player positions in `tournament_players`
- Match players by name

Live data architecture: ESPN for in-play leaderboard (every 2 min); RapidAPI for official positions and once-daily sync. See [AUTO_SCORING_SETUP.md](./AUTO_SCORING_SETUP.md) and [PRODUCT_OVERVIEW.md](./PRODUCT_OVERVIEW.md).

#### **Step 3: Calculate Winnings**
On the same `/admin/scores` page:
1. Click the green "💰 Calculate Winnings" button

This will:
- Calculate prize money for each player based on position
- Handle ties by splitting prize money
- Update `roster_players.player_winnings`
- Sum up `user_rosters.total_winnings`

### For Upcoming Tournaments:
- Winnings will be $0 until the tournament completes
- Users can create rosters and see their budget/players
- After tournament ends, follow steps above to calculate winnings

## Verifying Everything Works

### Admin Tools:
1. **View Rosters** (`/admin/rosters`): See all rosters with player names, positions, and individual winnings
2. **Weekly Standings** (`/standings/weekly/[tournamentId]`): See team standings sorted by total winnings

### What You Should See:
```
Team Standings
┌──────┬───────────────────┬──────────────┬─────────────────┐
│ RANK │ TEAM NAME         │ OWNER        │ TOTAL WINNINGS  │
├──────┼───────────────────┼──────────────┼─────────────────┤
│  1🏆 │ SCHLESS09         │ SCHLESS09    │ $1,234,567      │
│  2   │ ASCHUESSON...     │ Unknown      │ $987,654        │
└──────┴───────────────────┴──────────────┴─────────────────┘
```

## Technical Details

### Database Flow:
1. `prize_money_distributions` - Prize structure per tournament
2. `tournament_players.prize_money` - Individual player winnings
3. `roster_players.player_winnings` - Copy of prize money per roster
4. `user_rosters.total_winnings` - Sum of all player winnings

### API Endpoints:
- `POST /api/admin/prize-money` - Import prize distribution
- `POST /api/scores/sync` - Sync scores from LiveGolfAPI
- `POST /api/scores/calculate-winnings` - Calculate all winnings

## Troubleshooting

### Winnings Still Showing $0?
1. Check `/admin/rosters` to see if players have positions
2. Verify prize money was imported (`prize_money_distributions` table)
3. Re-run "Calculate Winnings" button
4. Check browser console for errors

### Players Not Matching?
- LiveGolfAPI player names must match `pga_players.name` exactly
- Check the sync logs for "Player not found" errors
- Manually update player names in database if needed

### RLS Policy Issue?
If you can only see your own roster:
- Run migration `008_allow_view_all_rosters.sql`
- This allows all authenticated users to VIEW all rosters (for standings)

## Example Sony Open Workflow

1. **Import Prize Money** for Sony Open
   - Total Purse: $8,700,000
   - 1st place: $1,566,000 (18%)
   - 2nd place: $948,300 (10.9%)
   - etc.

2. **Sync Scores**
   - LiveGolfAPI Event ID: `272e7c64-be4c-4081-8423-6d07af029626`
   - Gets leaderboard with final positions

3. **Calculate Winnings**
   - Nick Taylor (1st): $1,566,000
   - Nico Echavarria (2nd): $948,300
   - etc.
   - Team SCHLESS09 total: sum of their 10 players
