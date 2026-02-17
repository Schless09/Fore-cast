# FORE!cast Golf — Product Overview (for LLM context)

This document describes what the product does and how it is wired, so an LLM or new developer can reason about the codebase.

## What the product is

**FORE!cast Golf** is a fantasy golf web app. Users:

- Join **leagues** (friend groups) and optionally create leagues with a name/password.
- For each **tournament**, build a **roster** of PGA Tour players (salary-cap style; player costs come from sportsbook odds).
- Compete on **total prize money**: your roster’s score = sum of your players’ actual tournament winnings.
- View **live leaderboards** (full field and “my players” only), **weekly standings** (league rank by total winnings), and **season standings**.

Leagues can include or exclude specific tournaments. Rosters lock at tournament start (earliest tee time). Auth is Clerk; data is Supabase (PostgreSQL).

---

## Main user flows

| Flow | Where | What happens |
|------|--------|--------------|
| **Browse / pick tournament** | `/tournaments`, `/tournaments/[id]` | Tournament list and selector (filtered by league). Default tournament: active → completed (if before Monday noon CST) → upcoming. |
| **Build roster** | `/tournaments/[id]` (roster section) | Pick players under salary cap; roster locks at start. Stored in `user_rosters` + `roster_players`. |
| **Live leaderboard** | Same tournament page | Full field + “my players” highlighted. Data from **ESPN** (preferred) or **RapidAPI** cache. Thru column: holes played or tee time. Scorecards (hole-by-hole) from ESPN or RapidAPI. |
| **Weekly standings** | `/standings/weekly`, `/standings/weekly/[tournamentId]` | League rank by total winnings for one tournament. Same selector UX and default as Tournaments page (league-filtered; current week = active). |
| **Season standings** | `/standings/season` | Season-long league rank (sum of weekly winnings). |
| **Admin** | `/admin/*` | Tournaments, prize money, odds, tee times, scores sync, rankings sync. |

---

## Live scores: ESPN vs RapidAPI

Two data sources; different roles.

| Source | Purpose | When it runs | Where data lives |
|--------|--------|----------------|------------------|
| **ESPN** | Live leaderboard and scorecards during the tournament | Every **2 minutes** (Thu–Sun, tournament days) | `espn_cache` (key `espn-{espn_event_id}`) |
| **RapidAPI** (Live Golf Data) | Official wrap-up: tee times (R1/R2), leaderboard cache, mark tournament completed, sync final positions and winnings | **Once per day** (6 AM UTC) via `rapidapi-daily` cron | `live_scores_cache` (key `{year}-{tournId}`), `tournament_players` (tee_time_r1/r2, positions, prize_money) |

- **Tournament page** prefers **ESPN** when the tournament has `espn_event_id` and `espn_cache` has data (active/completed). Otherwise it uses RapidAPI cache or DB.
- **Scorecards** use ESPN when leaderboard is ESPN-sourced (`source=espn`); otherwise RapidAPI.
- **Tee times in DB** (`tournament_players.tee_time_r1/r2/r3/r4`) come only from **RapidAPI** (or CBS fallback when RapidAPI returns no matches). ESPN tee times exist only inside `espn_cache` and are used for display when showing ESPN-sourced leaderboard.

Relevant routes:

- **Read-through for UI**: `GET /api/scores/live?source=espn&eventId=...` (ESPN) or `?eventId=...` (RapidAPI).
- **Scorecards**: `GET /api/scores/espn-scorecard` (ESPN), `GET /api/scores/scorecard` (RapidAPI).

---

## Cron jobs (`vercel.json`)

| Path | Schedule | Purpose |
|------|----------|---------|
| `/api/scores/espn-sync` | Every **2 min** | Fetch ESPN scoreboard; fill `espn_cache` for tournaments with `espn_event_id`. Only runs on tournament days (Thu–Sun); interval 2 min. |
| `/api/scores/auto-sync` | Every **4 min** | **Tournament activation only**: flip `upcoming` → `active` when current time ≥ tournament start. No RapidAPI calls. |
| `/api/scores/rapidapi-daily` | **Once/day** (6 AM UTC) | Calls `auto-sync?force=true&source=rapidapi-daily` to run all RapidAPI logic: R1/R2 tee times for upcoming (within 2 days), leaderboard for active, mark completed, sync final scores and winnings. |
| `/api/cron/sync-rankings` | Mondays 5 PM UTC | Sync world rankings / FedEx Cup from RapidAPI. |
| `/api/reminders/missing-rosters` | Wed 9:15 PM, Thu 3 AM | Reminder flows for missing rosters (e.g. email). |

So: **ESPN** = live experience (frequent). **RapidAPI** = once per day for official state and DB (tee times, positions, winnings).

---

## Tournament selector and “current week”

- **Tournaments page** and **Weekly standings page** share the same UX:
  - Selector shows only tournaments **included in the user’s active league** (`filterTournamentsIncludedInLeague`).
  - Sort: active → upcoming (by start_date) → completed (recent first).
  - “Current week” = **active** tournament (if any). “View Current Week →” links to that tournament.
- **Default landing** for `/tournaments` and `/standings/weekly`: same league-filtered list; default tournament = active, else completed (if before Monday noon CST), else upcoming, else completed.

---

## Key backend concepts

- **Leagues**: `leagues`, `league_members`, `league_tournaments` (which tournaments count; can exclude). User has `active_league_id` on profile.
- **Tournaments**: `tournaments` (status: upcoming / active / completed). Optional `rapidapi_tourn_id`, `espn_event_id` for live data.
- **Field**: `tournament_players` links tournaments to `pga_players`; holds tee times (R1–R4), position, prize_money, scores.
- **Rosters**: `user_rosters` (per user per tournament), `roster_players` (which tournament_players; has `player_winnings`). Total winnings on `user_rosters.total_winnings`.
- **Caches**: `espn_cache`, `live_scores_cache` keyed by tournament; `api_call_log` for RapidAPI usage.

---

## Where to look in code

| Need | Location |
|------|----------|
| ESPN sync | `src/app/api/scores/espn-sync/route.ts` |
| RapidAPI + activation | `src/app/api/scores/auto-sync/route.ts` |
| RapidAPI daily trigger | `src/app/api/scores/rapidapi-daily/route.ts` |
| Live scores API (ESPN or RapidAPI) | `src/app/api/scores/live/route.ts` |
| Tournament page (leaderboard, ESPN preference) | `src/app/tournaments/[id]/page.tsx` |
| Weekly standings (selector, default) | `src/app/standings/weekly/page.tsx`, `src/app/standings/weekly/[tournamentId]/page.tsx` |
| League filtering | `src/lib/league-utils.ts` (`filterTournamentsIncludedInLeague`) |
| Winnings calculation | `src/lib/calculate-winnings.ts`, `src/lib/sync-scores.ts` |

---

## Other docs (reference)

- **README.md** — Setup, run, deploy.
- **WEEKLY_MANUAL_TASKS.md** — What to do manually each week (odds, prize money, tee times, weekly_update.py).
- **AUTO_SCORING_SETUP.md** — Cron env, sync behavior, troubleshooting.
- **LEAGUE_SYSTEM_GUIDE.md** — Leagues, join/create, multi-league.
- **TEAM_STANDINGS_GUIDE.md** — Weekly standings, prize money flow.
- **PRIZE_MONEY_SYSTEM.md** — Prize distribution, tie handling, APIs.
- **ENVIRONMENT_SETUP.md** — Env vars and checks.
