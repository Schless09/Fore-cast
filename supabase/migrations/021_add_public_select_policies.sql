-- Allow public/anon access to view pga_players (player info is not sensitive)
-- This fixes the "Unknown" player names issue when using Clerk auth
-- (Clerk users don't have Supabase 'authenticated' role)

CREATE POLICY "Public can view PGA players"
ON pga_players FOR SELECT
TO public
USING (true);

-- Allow public/anon access to view tournament_players
CREATE POLICY "Public can view tournament players"
ON tournament_players FOR SELECT
TO public
USING (true);
