# Weekly manual tasks

What needs to be done manually each week for FORE!cast Golf.

---

## Pre-tournament (Tuesday–Wednesday)

### 1. Import odds & costs (`/admin/odds`)

- **When**: Before roster lock (typically Tuesday or Wednesday)
- **What**: Upload sportsbook odds CSV
- **Format**: Player, Winner, Top 5 (optional), Top 10 (optional)
  - Example: `Scottie Scheffler,+320,-144,-300`
- **Effect**: Creates/updates `tournament_players` for the field and sets `cost` from winner odds
- **Options**:
  - **Clear existing field first**: Rebuilds the entire field from the CSV (use when replacing the field)
  - **Update only**: Matches by name and updates odds/cost for existing players

### 2. (Optional) Manually set tee times (`/admin/tee-times`)

- **When**: Wednesday before R1 (if RapidAPI/CBS don’t have them yet)
- **What**: Paste R1/R2 tee times (CSV or tab-separated)
- **When to use**: RapidAPI runs once/day at 6 AM UTC; CBS fallback only runs when RapidAPI returns 0 matches. If tee times are missing on the weekly standings page, upload them here.

### 3. Import prize money (`/admin/prize-money`)

- **When**: Pre-tournament (before roster lock)
- **What**: Upload prize money distribution CSV
- **Format**: Pos., Pct., Amount (and optional tie columns)
- **Effect**: Populates `prize_money_distributions` for that tournament

### 4. Tournament setup

- Ensure `rapidapi_tourn_id` and `espn_event_id` are set for live leaderboards
- Add tournament to league schedule if needed (`/admin/leagues` → tournament settings)

---

## Post-tournament (Monday)

### 1. Sync scores & calculate winnings (`/admin/scores`)

- **When**: After the tournament finishes (Monday)
- **What**: Use “Sync Scores” to pull positions from RapidAPI (or wait for rapidapi-daily at 6 AM UTC)
- **Then**: Click “Calculate Winnings” to compute prize money per player and roster totals

### 2. Run weekly_update.py

- **When**: After the tournament is complete and results are posted
- **What**: Updates `historical_tournament_results` and `pga_players` skill profiles from Data Golf

**Preferred – use field from odds** (player list from `tournament_players`, populated when you import odds):

```bash
python weekly_update.py --tournament-id <UUID> 2>&1 | tee output/weekly.log
```

**Auto-detect most recent PGA event** (fetches field from Data Golf):

```bash
python weekly_update.py 2>&1 | tee output/weekly.log
```

**Specific Data Golf event**:

```bash
python weekly_update.py --event 4 --year 2026 2>&1 | tee output/weekly.log
```

---

## Summary checklist

| Task | Page / Command | When |
|------|----------------|------|
| Import odds (field + costs) | `/admin/odds` | Pre-tournament (Tue–Wed) |
| Import prize money | `/admin/prize-money` | Pre-tournament (Tue–Wed) |
| Manually set tee times | `/admin/tee-times` | Wed (if needed) |
| Sync scores | `/admin/scores` | Post-tournament (Mon) |
| Calculate winnings | `/admin/scores` | Post-tournament (Mon) |
| Run weekly_update.py | `python weekly_update.py --tournament-id <UUID> ...` | Post-tournament (Mon) |

---

## Related docs

- **[AUTO_SCORING_SETUP.md](./AUTO_SCORING_SETUP.md)** — Cron jobs, ESPN vs RapidAPI
- **[TEAM_STANDINGS_GUIDE.md](./TEAM_STANDINGS_GUIDE.md)** — Prize money and winnings flow
- **[PRIZE_MONEY_SYSTEM.md](./PRIZE_MONEY_SYSTEM.md)** — Prize distribution and tie handling
