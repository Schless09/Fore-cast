-- Document that cut_count = NULL means no-cut event (Sentry, CJ Cup, etc.)
-- When NULL: no projected cut in R1/R2, no MC or prize zeroing in R3+
-- When set (e.g. 65, 50): standard cut logic applies

COMMENT ON COLUMN tournaments.cut_count IS 'Top N and ties make the cut (e.g. 65 PGA Tour, 50 Signature). NULL = no-cut event (everyone plays all 4 rounds).';
