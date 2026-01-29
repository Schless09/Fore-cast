// TypeScript types for the FORE!SIGHT Golf application

export interface League {
  id: string;
  name: string;
  password: string;
  created_at: string;
  updated_at: string;
}

export interface LeagueMember {
  id: string;
  user_id: string;
  league_id: string;
  joined_at: string;
  is_active: boolean;
}

export interface Profile {
  id: string;
  username: string;
  email: string;
  league_id: string | null; // Deprecated, use active_league_id
  active_league_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PGAPlayer {
  id: string;
  name: string;
  country: string | null;
  world_ranking: number | null;
  fedex_cup_ranking: number | null;
  image_url: string | null;
  is_active: boolean;
  is_amateur: boolean;
  created_at: string;
}

export interface Tournament {
  id: string;
  name: string;
  course: string | null;
  start_date: string;
  end_date: string;
  current_round: number;
  status: 'upcoming' | 'active' | 'completed';
  rapidapi_tourn_id?: string | null;
  last_updated: string;
  created_at: string;
}

export interface TournamentPlayer {
  id: string;
  tournament_id: string;
  pga_player_id: string;
  total_score: number;
  today_score: number;
  thru: number;
  position: number | null;
  made_cut: boolean;
  round_1_score: number | null;
  round_2_score: number | null;
  round_3_score: number | null;
  round_4_score: number | null;
  cost: number;
  winner_odds: number | null;
  top5_odds: number | null;
  top10_odds: number | null;
  prize_money: number;
  is_tied: boolean;
  tied_with_count: number;
  tee_time: string | null;
  starting_tee: number | null;
  tee_time_r1: string | null;
  tee_time_r2: string | null;
  starting_tee_r1: number | null;
  starting_tee_r2: number | null;
  created_at: string;
  updated_at: string;
  // Joined data
  pga_player?: PGAPlayer;
}

export interface UserRoster {
  id: string;
  user_id: string;
  tournament_id: string;
  roster_name: string;
  total_fantasy_points: number;
  total_winnings: number;
  budget_spent: number;
  max_players: number;
  budget_limit: number;
  created_at: string;
  updated_at: string;
  // Joined data
  tournament?: Tournament;
  roster_players?: RosterPlayer[];
}

export interface RosterPlayer {
  id: string;
  roster_id: string;
  tournament_player_id: string;
  fantasy_points: number;
  player_winnings: number;
  added_at: string;
  // Joined data
  tournament_player?: TournamentPlayer;
}

export interface ScoringRule {
  id: string;
  rule_type: string;
  points: number;
  description: string | null;
  created_at: string;
}

// Extended types for UI
export interface RosterWithDetails extends UserRoster {
  tournament: Tournament;
  roster_players: (RosterPlayer & {
    tournament_player: TournamentPlayer & {
      pga_player: PGAPlayer;
    };
  })[];
}

export interface TournamentWithPlayers extends Tournament {
  tournament_players: (TournamentPlayer & {
    pga_player: PGAPlayer;
  })[];
}

export interface PrizeMoneyDistribution {
  id: string;
  tournament_id: string;
  total_purse: number;
  position: number;
  percentage: number | null;
  amount: number;
  created_at: string;
}
