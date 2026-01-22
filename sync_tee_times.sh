#!/bin/bash

# Sync tee times and scores for The American Express
# Run this script to populate tee times before the tournament starts

echo "Syncing tee times for The American Express..."

# Get the tournament ID from Supabase
# You'll need to replace TOURNAMENT_ID with your actual tournament UUID

TOURNAMENT_ID="YOUR_TOURNAMENT_UUID_HERE"
LIVEGOLFAPI_EVENT_ID="291e61c6-b1e4-49d6-a84e-99864e73a2be"
APP_URL="https://fore-cast-phi.vercel.app"

curl -X POST "$APP_URL/api/scores/sync" \
  -H "Content-Type: application/json" \
  -d "{
    \"tournamentId\": \"$TOURNAMENT_ID\",
    \"liveGolfAPITournamentId\": \"$LIVEGOLFAPI_EVENT_ID\"
  }"

echo ""
echo "Sync complete! Check your tournament page for updated tee times."
