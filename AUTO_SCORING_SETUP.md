# Automatic score and live data setup

How live leaderboards and official results are kept in sync.

## Architecture (ESPN + RapidAPI)

| Source | Role | Schedule | What it updates |
|--------|------|----------|------------------|
| **ESPN** | Live leaderboard and scorecards during the tournament | Every **2 minutes** (tournament days Thu–Sun) | `espn_cache` |
| **RapidAPI** (Live Golf Data) | Official wrap-up: tee times, final positions, winnings | **Once per day** (6 AM UTC) | `live_scores_cache`, `tournament_players` (tee times, position, prize_money), tournament status |

- **Tournament page** prefers ESPN when `espn_event_id` is set and cache has data; otherwise uses RapidAPI cache or DB.
- **Tee times in the DB** come only from RapidAPI (or CBS fallback if RapidAPI returns no matches). ESPN tee times are only in `espn_cache` for display.

See **[PRODUCT_OVERVIEW.md](./PRODUCT_OVERVIEW.md)** for full context.

## Required environment variables

In Vercel or `.env.local`:

```bash
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
CRON_SECRET=<secure-random-string>

# RapidAPI (Live Golf Data) — used by rapidapi-daily and admin sync
RAPIDAPI_KEY=<your-rapidapi-key>
```

Generate `CRON_SECRET` (e.g. `openssl rand -base64 32`).

## Cron jobs (vercel.json)

| Path | Schedule | Purpose |
|------|----------|---------|
| `/api/scores/espn-sync` | `*/2 * * * *` (every 2 min) | Fetch ESPN scoreboard; update `espn_cache` for tournaments with `espn_event_id`. Only runs on tournament days (Thu–Sun). |
| `/api/scores/auto-sync` | `*/4 * * * *` (every 4 min) | Tournament **activation only**: set status `upcoming` → `active` when start time has passed. No API calls. |
| `/api/scores/rapidapi-daily` | `0 6 * * *` (daily 6 AM UTC) | Runs all RapidAPI logic by calling `auto-sync?force=true&source=rapidapi-daily`: tee times (R1/R2) for upcoming, leaderboard for active, mark completed, sync final scores and winnings. |

Other crons: rankings sync (Mondays), roster reminders (Wed/Thu).

## Enabling live data for a tournament

1. **ESPN** (live leaderboard + scorecards): Set `espn_event_id` on the tournament (e.g. from ESPN scoreboard URL). ESPN sync will fill `espn_cache` for that event.
2. **RapidAPI** (tee times, official results): Set `rapidapi_tourn_id` (e.g. `"002"`, `"004"`). Used by rapidapi-daily and admin “Sync scores”.

Mark the tournament **active** when it starts (auto-sync does this automatically from start date + earliest tee time).

## Manual sync

- **Force full RapidAPI run** (tee times + leaderboard + wrap-up):  
  `GET /api/scores/auto-sync?force=true` with `Authorization: Bearer <CRON_SECRET>` (or while signed in as admin).
- **Admin scores page** (`/admin/scores`): Select tournament and use “Sync Scores” to pull from RapidAPI and update positions/winnings.

## Monitoring

- **Vercel** → Logs: filter by `/api/scores/espn-sync`, `/api/scores/auto-sync`, `/api/scores/rapidapi-daily`.
- **RapidAPI usage**: `api_call_log` rows with `api_name = 'rapidapi'` (leaderboard and tournament endpoints).

## Troubleshooting

**No live leaderboard**

- Tournament has `espn_event_id` and is active? ESPN sync runs every 2 min on Thu–Sun.
- If using RapidAPI only: cache is updated once per day; use “Force sync” or wait for 6 AM UTC run.

**Tee times missing in DB**

- RapidAPI runs once per day. Ensure `rapidapi_tourn_id` is set. If RapidAPI returns no matches, CBS Sports fallback runs (same daily run).
- ESPN tee times are not written to DB; they only appear from `espn_cache` when the UI uses ESPN data.

**Scores / winnings not finalizing**

- When tournament status becomes “Official”, auto-sync (during rapidapi-daily) marks it completed and runs score sync + winnings calculation. Trigger manually with `?force=true` if needed.

## Testing locally

```bash
# ESPN sync (tournament days only)
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/scores/espn-sync

# RapidAPI full run (activation + tee times + leaderboard + wrap-up)
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/scores/auto-sync?force=true"
```
