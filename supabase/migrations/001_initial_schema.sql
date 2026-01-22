-- FORE!cast Golf App - Initial Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Table: pga_players
CREATE TABLE IF NOT EXISTS pga_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  country TEXT,
  world_ranking INTEGER,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for pga_players
ALTER TABLE pga_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view PGA players"
  ON pga_players FOR SELECT
  TO authenticated
  USING (true);

-- Table: tournaments
CREATE TABLE IF NOT EXISTS tournaments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  course TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  current_round INTEGER DEFAULT 1,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed')),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for tournaments
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tournaments"
  ON tournaments FOR SELECT
  TO authenticated
  USING (true);

-- Table: tournament_players
CREATE TABLE IF NOT EXISTS tournament_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  pga_player_id UUID REFERENCES pga_players(id) ON DELETE CASCADE,
  total_score INTEGER DEFAULT 0,
  today_score INTEGER DEFAULT 0,
  thru INTEGER DEFAULT 0,
  position INTEGER,
  made_cut BOOLEAN DEFAULT true,
  round_1_score INTEGER,
  round_2_score INTEGER,
  round_3_score INTEGER,
  round_4_score INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, pga_player_id)
);

-- RLS Policies for tournament_players
ALTER TABLE tournament_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tournament players"
  ON tournament_players FOR SELECT
  TO authenticated
  USING (true);

-- Table: user_rosters
CREATE TABLE IF NOT EXISTS user_rosters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  roster_name TEXT NOT NULL,
  total_fantasy_points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tournament_id, roster_name)
);

-- RLS Policies for user_rosters
ALTER TABLE user_rosters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rosters"
  ON user_rosters FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own rosters"
  ON user_rosters FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rosters"
  ON user_rosters FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own rosters"
  ON user_rosters FOR DELETE
  USING (auth.uid() = user_id);

-- Table: roster_players
CREATE TABLE IF NOT EXISTS roster_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  roster_id UUID REFERENCES user_rosters(id) ON DELETE CASCADE,
  tournament_player_id UUID REFERENCES tournament_players(id) ON DELETE CASCADE,
  fantasy_points INTEGER DEFAULT 0,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(roster_id, tournament_player_id)
);

-- RLS Policies for roster_players
ALTER TABLE roster_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view players in own rosters"
  ON roster_players FOR SELECT
  USING (
    roster_id IN (
      SELECT id FROM user_rosters WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add players to own rosters"
  ON roster_players FOR INSERT
  WITH CHECK (
    roster_id IN (
      SELECT id FROM user_rosters WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove players from own rosters"
  ON roster_players FOR DELETE
  USING (
    roster_id IN (
      SELECT id FROM user_rosters WHERE user_id = auth.uid()
    )
  );

-- Table: scoring_rules
CREATE TABLE IF NOT EXISTS scoring_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_type TEXT NOT NULL UNIQUE,
  points INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default scoring rules
INSERT INTO scoring_rules (rule_type, points, description) VALUES
  ('position_1', 30, 'First place'),
  ('position_2', 25, 'Second place'),
  ('position_3', 22, 'Third place'),
  ('position_top_5', 18, 'Top 5 finish'),
  ('position_top_10', 15, 'Top 10 finish'),
  ('position_top_20', 10, 'Top 20 finish'),
  ('birdie', 1, 'Per birdie'),
  ('eagle', 3, 'Per eagle'),
  ('cut_missed', -5, 'Missed the cut'),
  ('made_cut', 5, 'Made the cut')
ON CONFLICT (rule_type) DO NOTHING;

-- RLS Policies for scoring_rules
ALTER TABLE scoring_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view scoring rules"
  ON scoring_rules FOR SELECT
  TO authenticated
  USING (true);

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable real-time on tables
ALTER PUBLICATION supabase_realtime ADD TABLE tournament_players;
ALTER PUBLICATION supabase_realtime ADD TABLE user_rosters;
ALTER PUBLICATION supabase_realtime ADD TABLE roster_players;
