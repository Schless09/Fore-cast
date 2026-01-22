# Automatic Score Syncing Setup

This guide explains how to set up automatic score syncing for live tournaments.

## How It Works

The system automatically syncs scores from LiveGolfAPI every 5 minutes during active tournaments using Vercel Cron Jobs.

## Setup Steps

### 1. Set Required Environment Variables

Add these to your Vercel project or `.env.local`:

```bash
# Your app URL (important for cron to call the sync endpoint)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# Generate a random secret for cron authentication
CRON_SECRET=your-random-secret-here-generate-a-secure-one
```

To generate a secure `CRON_SECRET`:
```bash
# On Mac/Linux:
openssl rand -base64 32

# Or use any secure random string generator
```

### 2. Configure Vercel Cron (Already Done!)

The `vercel.json` file is already configured to run `/api/scores/auto-sync` every 5 minutes.

### 3. Deploy to Vercel

```bash
# Push your changes
git add .
git commit -m "Add automatic score syncing"
git push

# Vercel will automatically detect vercel.json and set up the cron job
```

### 4. Add CRON_SECRET to Vercel

In your Vercel project dashboard:
1. Go to **Settings** → **Environment Variables**
2. Add `CRON_SECRET` with the value you generated
3. Add `NEXT_PUBLIC_APP_URL` with your production URL
4. Redeploy for changes to take effect

### 5. Mark Tournament as "Active"

For auto-sync to work:
1. Go to `/admin/tournaments`
2. Set tournament status to **"Active (Live)"**
3. Ensure `livegolfapi_event_id` is set

## How Auto-Sync Works

1. **Every 5 minutes**, Vercel Cron calls `/api/scores/auto-sync`
2. The endpoint finds all tournaments with `status = 'active'`
3. For each tournament, it calls `/api/scores/sync` to fetch latest scores
4. Scores are updated in the database
5. Fantasy points are automatically recalculated

## Manual Sync

You can still manually sync scores anytime from `/admin/scores`

## Monitoring

Check cron job execution in Vercel:
1. Go to your project in Vercel
2. Navigate to **Logs**
3. Filter by `/api/scores/auto-sync` to see sync activity

## Troubleshooting

### Scores Not Updating

1. **Check tournament status:**
   - Must be set to "active"
   - Must have `livegolfapi_event_id`

2. **Check environment variables:**
   - `CRON_SECRET` is set in Vercel
   - `NEXT_PUBLIC_APP_URL` points to your production URL

3. **Check Vercel logs:**
   - Look for errors in `/api/scores/auto-sync` calls
   - Verify cron is running every 5 minutes

4. **Check LiveGolfAPI:**
   - Ensure API is returning data
   - Check player name matching

### Cron Not Running

1. Ensure `vercel.json` is in project root
2. Redeploy after adding/changing cron configuration
3. Check Vercel dashboard for cron job status

## Adjusting Sync Frequency

Edit `vercel.json` to change frequency:

```json
{
  "crons": [
    {
      "path": "/api/scores/auto-sync",
      "schedule": "*/5 * * * *"  // Every 5 minutes
      // "schedule": "*/10 * * * *"  // Every 10 minutes
      // "schedule": "*/2 * * * *"   // Every 2 minutes
    }
  ]
}
```

**Note:** More frequent syncs = more API calls. Balance between freshness and API limits.

## Cost Considerations

- **Vercel Cron:** Free on all plans
- **API Calls:** 12 calls per hour per active tournament (at 5-minute intervals)
- **Database Writes:** Minimal cost, one update per player per sync

## Testing Locally

For local testing, you can manually trigger the auto-sync:

```bash
curl -X POST http://localhost:3000/api/scores/auto-sync \
  -H "Authorization: Bearer your-cron-secret"
```

## Next Steps After Tournament

After tournament completes:
1. Set tournament status to "completed"
2. Run `/api/scores/calculate-winnings` to finalize prize money
3. Auto-sync will stop automatically (only syncs "active" tournaments)
