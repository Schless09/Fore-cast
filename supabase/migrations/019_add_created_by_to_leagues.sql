-- Add created_by column to leagues table
-- This tracks who created each league

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leagues' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE leagues ADD COLUMN created_by UUID REFERENCES profiles(id);
  END IF;
END $$;

-- Create index for lookups
CREATE INDEX IF NOT EXISTS idx_leagues_created_by ON leagues(created_by);

COMMENT ON COLUMN leagues.created_by IS 'The user who created this league';
