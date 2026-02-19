-- Roster version history: snapshot of a roster when the user edits it.
-- Used after the tournament to compute "would-have-been" score for previous lineups
-- and optionally email users if they would have finished in the money with an old lineup.

CREATE TABLE IF NOT EXISTS roster_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roster_id UUID NOT NULL REFERENCES user_rosters(id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  budget_spent DECIMAL(5,2),
  roster_name TEXT
);

CREATE INDEX IF NOT EXISTS idx_roster_versions_roster_id ON roster_versions(roster_id);
CREATE INDEX IF NOT EXISTS idx_roster_versions_tournament_user ON roster_versions(tournament_id, user_id);

COMMENT ON TABLE roster_versions IS 'Snapshot of a roster when user edited it; used post-tournament for would-have-been scoring and optional email.';

CREATE TABLE IF NOT EXISTS roster_version_players (
  roster_version_id UUID NOT NULL REFERENCES roster_versions(id) ON DELETE CASCADE,
  tournament_player_id UUID NOT NULL REFERENCES tournament_players(id) ON DELETE CASCADE,
  PRIMARY KEY (roster_version_id, tournament_player_id)
);

CREATE INDEX IF NOT EXISTS idx_roster_version_players_version ON roster_version_players(roster_version_id);

COMMENT ON TABLE roster_version_players IS 'Players in a roster version snapshot; used to sum prize_money for would-have-been total.';

ALTER TABLE roster_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_version_players ENABLE ROW LEVEL SECURITY;

-- Users can view their own roster versions (e.g. future "edit history" UI). Inserts happen via service client in API.
CREATE POLICY "Users can view own roster versions"
  ON roster_versions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can view own roster version players"
  ON roster_version_players FOR SELECT
  USING (
    roster_version_id IN (
      SELECT id FROM roster_versions WHERE user_id = auth.uid()
    )
  );
