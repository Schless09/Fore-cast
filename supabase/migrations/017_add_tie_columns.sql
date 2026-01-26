-- Add pre-calculated tie amount columns to prize_money_distributions
-- These store the official PGA Tour tie split amounts for accuracy

ALTER TABLE prize_money_distributions
ADD COLUMN IF NOT EXISTS tied_2 DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS tied_3 DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS tied_4 DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS tied_5 DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS tied_6 DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS tied_7 DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS tied_8 DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS tied_9 DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS tied_10 DECIMAL(12,2);

COMMENT ON COLUMN prize_money_distributions.tied_2 IS 'Pre-calculated amount when 2 players tie at this position';
COMMENT ON COLUMN prize_money_distributions.tied_3 IS 'Pre-calculated amount when 3 players tie at this position';
COMMENT ON COLUMN prize_money_distributions.tied_4 IS 'Pre-calculated amount when 4 players tie at this position';
COMMENT ON COLUMN prize_money_distributions.tied_5 IS 'Pre-calculated amount when 5 players tie at this position';
COMMENT ON COLUMN prize_money_distributions.tied_6 IS 'Pre-calculated amount when 6 players tie at this position';
COMMENT ON COLUMN prize_money_distributions.tied_7 IS 'Pre-calculated amount when 7 players tie at this position';
COMMENT ON COLUMN prize_money_distributions.tied_8 IS 'Pre-calculated amount when 8 players tie at this position';
COMMENT ON COLUMN prize_money_distributions.tied_9 IS 'Pre-calculated amount when 9 players tie at this position';
COMMENT ON COLUMN prize_money_distributions.tied_10 IS 'Pre-calculated amount when 10 players tie at this position';
