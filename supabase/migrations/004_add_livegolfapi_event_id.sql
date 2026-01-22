-- Add LiveGolfAPI event id to tournaments for leaderboard sync
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS livegolfapi_event_id TEXT;

COMMENT ON COLUMN tournaments.livegolfapi_event_id IS 'LiveGolfAPI event ID for syncing leaderboards and scores';
