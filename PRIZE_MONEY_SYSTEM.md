# Prize Money Scoring System

## Overview

The FORE!cast Golf application uses **actual tournament prize money** as the scoring system instead of traditional fantasy points. The goal is to build "the best roster of winnings" - your roster's total winnings is the sum of all your players' prize money.

## How It Works

1. **Import Prize Money Distribution**: Admin imports the tournament's prize money payout table
2. **Sync Player Positions**: Positions are synced from RapidAPI (Live Golf Data) or via admin "Sync Scores"; final positions stored in `tournament_players`
3. **Calculate Winnings**: System automatically calculates each player's prize money based on:
   - Final position
   - Tie handling (ties split combined prize money)
4. **Roster Total**: Each roster's `total_winnings` = sum of all players' `player_winnings`

## Key Features

### Tie Handling
- If 2 players tie for 2nd place, they split the combined 2nd + 3rd place prize money
- If 3 players tie for 5th place, they split the combined 5th + 6th + 7th place prize money
- This is handled automatically by the `calculatePlayerPrizeMoney` function

### Example Scenario
- You pick the winner (1st place = $1,656,000)
- Your other 9 players all miss the cut (0 winnings)
- **Your total winnings: $1,656,000**
- If you're the only person in the pool who picked the winner, you win!

## Database Schema

### New Tables
- `prize_money_distributions`: Stores prize money payout structure per tournament
  - `tournament_id`, `total_purse`, `position`, `percentage`, `amount`

### Updated Tables
- `tournament_players`: Added `prize_money`, `is_tied`, `tied_with_count`
- `user_rosters`: Added `total_winnings`
- `roster_players`: Added `player_winnings`

## API Endpoints

### Import Prize Money Distribution
```
POST /api/admin/prize-money
Body: {
  tournamentId: string,
  totalPurse: number,
  distributions: [{ position, percentage?, amount }]
}
```

### Calculate Winnings
```
POST /api/scores/calculate-winnings
Body: { tournamentId: string }
```

This endpoint:
1. Loads prize money distribution for the tournament
2. Detects ties from player positions
3. Calculates prize money for each player
4. Updates `tournament_players.prize_money`
5. Updates `roster_players.player_winnings`
6. Recalculates `user_rosters.total_winnings`

## Admin Workflow

1. **Create Tournament**: Set up tournament in admin panel
2. **Import Odds**: Import sportsbook odds to calculate player costs
3. **Import Prize Money**: Go to `/admin/prize-money` and import the prize money distribution
4. **Sync Scores**: Use `/admin/scores` to sync player positions from RapidAPI (or run rapidapi-daily / auto-sync?force=true)
5. **Calculate Winnings**: After tournament completion, click "Calculate Winnings" to finalize prize money

## Example: American Express 2026

Total Purse: $9,200,000

- 1st Place: 18% = $1,656,000
- 2nd Place: 10.90% = $1,002,800
- 3rd Place: 6.90% = $634,800
- ... (see `src/app/admin/prize-money/american-express-example.json` for full table)

## UI Updates

- **Leaderboard**: Shows "Prize Money" instead of "Fantasy Pts"
- **Dashboard**: Shows "Total Winnings" instead of "Total Fantasy Points"
- **Player Rows**: Display formatted currency (e.g., "$1,656,000")
- **Tie Indicator**: Shows "T" prefix for tied positions

## Migration

Run the migration in Supabase SQL Editor:
```sql
-- Run: supabase/migrations/003_add_prize_money.sql
```

This adds all necessary columns and tables for the prize money system.
