-- Add money board settings columns to leagues table
-- These allow commissioners to customize their league's Money Board page

ALTER TABLE leagues
  ADD COLUMN IF NOT EXISTS google_sheet_url TEXT,           -- Link to open in Google Sheets
  ADD COLUMN IF NOT EXISTS google_sheet_embed_url TEXT,     -- iframe embed URL  
  ADD COLUMN IF NOT EXISTS buy_in_amount INTEGER,           -- Buy-in price in dollars
  ADD COLUMN IF NOT EXISTS venmo_username TEXT,             -- e.g. "@Andrew-Schuessler-2"
  ADD COLUMN IF NOT EXISTS venmo_qr_image_path TEXT,        -- Path in Supabase storage
  ADD COLUMN IF NOT EXISTS payment_instructions TEXT,       -- Optional payment notes
  ADD COLUMN IF NOT EXISTS payout_description TEXT;         -- Free-form payout rules text

-- Create storage bucket for league assets (Venmo QR codes, etc.)
-- Note: This needs to be created manually in Supabase dashboard or via CLI:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('league-assets', 'league-assets', true);

COMMENT ON COLUMN leagues.google_sheet_url IS 'Link to open the league spreadsheet in Google Sheets';
COMMENT ON COLUMN leagues.google_sheet_embed_url IS 'iframe embed URL for displaying the spreadsheet';
COMMENT ON COLUMN leagues.buy_in_amount IS 'Season buy-in price in dollars';
COMMENT ON COLUMN leagues.venmo_username IS 'Venmo username for payments (e.g. @username)';
COMMENT ON COLUMN leagues.venmo_qr_image_path IS 'Path to Venmo QR code image in Supabase storage';
COMMENT ON COLUMN leagues.payment_instructions IS 'Optional payment instructions or notes';
COMMENT ON COLUMN leagues.payout_description IS 'Free-form description of payout structure (e.g. 1st: 45%, 2nd: 30%)';
