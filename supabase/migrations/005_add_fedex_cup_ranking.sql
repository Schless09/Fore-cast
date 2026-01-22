-- Add FedEx Cup ranking to PGA players
ALTER TABLE pga_players 
ADD COLUMN fedex_cup_ranking INTEGER NULL;

-- Add index for performance
CREATE INDEX idx_pga_players_fedex_cup_ranking ON pga_players(fedex_cup_ranking);

-- Add comment
COMMENT ON COLUMN pga_players.fedex_cup_ranking IS 'Current FedEx Cup standings ranking';
