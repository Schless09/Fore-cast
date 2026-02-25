# Automatic score and live data setup

How live leaderboards and official results are kept in sync.

## Architecture (ESPN + RapidAPI)

| Source | Role | Schedule | What it updates |
|--------|------|----------|------------------|
| **ESPN** | Live leaderboard and scorecards during the tournament | Every **2 minutes** (tournament days Thu–Sun) | `espn_cache` |
| **RapidAPI** (Live Golf Data) | Official wrap-up: leaderboard cache, final positions, winnings | **Once per day** (6 AM UTC) | `live_scores_cache`, `tournament_players` (position, prize_money), tournament status |
| **CBS** (leaderboard scrape) | Tee times (R1/R2) and withdrawal detection | **Tue–Thu** 3x daily (2pm, 8pm, 4am CST) + Thu 7am CST | `tournament_players` (tee_time_r1/r2, withdrawn) |

- **Tournament page** prefers ESPN when `espn_event_id` is set and cache has data; otherwise uses RapidAPI cache or DB.
- **Tee times in the DB** come only from CBS (leaderboard scrape Tue–Thu pre-tournament). EST timezone. ESPN tee times are only in `espn_cache` for display.

See **[PRODUCT_OVERVIEW.md](./PRODUCT_OVERVIEW.md)** for full context.

## Suspended play & PGA TOUR Comms

When ESPN reports `STATUS_SUSPENDED` (e.g. rain delay), the live leaderboard shows a banner with a link to [@PGATOURComms](https://x.com/PGATOURComms) on X for live updates.

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
| `/api/scores/rapidapi-daily` | `0 6 * * *` (daily 6 AM UTC) | Runs RapidAPI logic: leaderboard for active tournaments, mark completed, sync final scores and winnings. |
| `/api/cron/check-withdrawals` | `0 6,12,18 * * 2,3,4` (Tue–Thu only, 3x daily UTC) | CBS leaderboard scrape: sync R1/R2 tee times, add replacements (alternates on CBS not in DB), mark WD for DB players not on CBS, email affected roster owners. Replacements get default cost ($2.50); update via Admin → Odds if you have their odds. |

Other crons: rankings sync (Mondays), roster reminders (Wed/Thu).

## Enabling live data for a tournament

1. **ESPN** (live leaderboard + scorecards): Set `espn_event_id` on the tournament (e.g. from ESPN scoreboard URL). ESPN sync will fill `espn_cache` for that event.
2. **RapidAPI** (leaderboard, official results): Set `rapidapi_tourn_id` (e.g. `"002"`, `"004"`). Used by rapidapi-daily and admin “Sync scores”.
3. **Tee times**: CBS only (no config). check-withdrawals cron syncs Tue–Thu pre-tournament.

Mark the tournament **active** when it starts (auto-sync does this automatically from start date + earliest tee time).

## Manual sync

- **Force full RapidAPI run** (leaderboard + wrap-up):  
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

- CBS sync runs Tue–Thu 3x daily (2pm, 8pm, 4am CST) plus Thu 7am CST. CBS must have published tee times (typically Wed).
- Ensure tournament has players in DB; check-withdrawals compares DB vs CBS and syncs when match rate ≥ 60%.

**Scores / winnings not finalizing**

- When tournament status becomes “Official”, auto-sync (during rapidapi-daily) marks it completed and runs score sync + winnings calculation. Trigger manually with `?force=true` if needed.

## Testing locally

```bash
# ESPN sync (tournament days only)
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/scores/espn-sync

# RapidAPI full run (activation + leaderboard + wrap-up)
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/scores/auto-sync?force=true"

# Mass-save player headshots to pga_players from ESPN cache (run ESPN sync first; dev: no auth needed)
# curl -X POST http://localhost:3000/api/admin/sync-player-headshots
```
