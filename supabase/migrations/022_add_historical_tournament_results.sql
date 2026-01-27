-- Historical tournament results for player performance tracking
-- This table stores past tournament results for each player

CREATE TABLE IF NOT EXISTS public.historical_tournament_results (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  pga_player_id uuid NOT NULL,
  tournament_name text NOT NULL,
  course_name text NULL,
  venue_id text NULL,
  tournament_date date NOT NULL,
  finish_position integer NULL,
  is_made_cut boolean NULL DEFAULT true,
  total_score integer NULL,
  strokes_gained_total numeric(10, 2) NULL,
  strokes_gained_putting numeric(10, 2) NULL,
  strokes_gained_approach numeric(10, 2) NULL,
  strokes_gained_around_green numeric(10, 2) NULL,
  strokes_gained_off_tee numeric(10, 2) NULL,
  prize_money numeric(12, 2) NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT historical_tournament_results_pkey PRIMARY KEY (id),
  CONSTRAINT historical_tournament_results_unique UNIQUE (pga_player_id, tournament_name, tournament_date),
  CONSTRAINT historical_tournament_results_pga_player_id_fkey FOREIGN KEY (pga_player_id) REFERENCES pga_players (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_historical_results_player ON public.historical_tournament_results USING btree (pga_player_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_historical_results_date ON public.historical_tournament_results USING btree (tournament_date DESC) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_historical_results_venue ON public.historical_tournament_results USING btree (venue_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_historical_results_player_venue ON public.historical_tournament_results USING btree (pga_player_id, venue_id) TABLESPACE pg_default;

-- RLS policies
ALTER TABLE public.historical_tournament_results ENABLE ROW LEVEL SECURITY;

-- Allow public read access (historical data is not sensitive)
CREATE POLICY "Public can view historical results"
ON public.historical_tournament_results FOR SELECT
TO public
USING (true);
