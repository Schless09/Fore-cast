# FORE!cast Golf - Predict. Play. Win.

A complete fantasy golf statistics and live leaderboard web application where users can create their own roster of PGA Tour players and track their performance in real-time.

## Features

- 🏌️ **Fantasy Golf Rosters**: Create custom rosters of PGA Tour players for each tournament
- 📊 **Personalized Leaderboards**: See ONLY your selected players with real-time updates
- 🏆 **Fantasy Scoring**: Points based on player performance, position, and achievements
- ⚡ **Real-time Updates**: Live score updates via Supabase subscriptions
- 🔐 **User Authentication**: Secure sign-up and login with Supabase Auth
- 📱 **Responsive Design**: Beautiful, mobile-first UI built with Tailwind CSS
- 👨‍💼 **Admin Dashboard**: Manage tournaments, players, and scores

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, React, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Real-time)
- **Deployment**: Vercel (free tier)

## Getting Started

### Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier works)
- Supabase project with the provided credentials

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd golfstats-supabase
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` or `.env.local` file in the root directory (`.env.local` is recommended as it's automatically ignored by git):
```env
NEXT_PUBLIC_SUPABASE_URL=https://fqqdqogxuwygozermral.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=sb_secret_9zwZ-dxJU5qS30c1sqQIXg_LUL8S0Bx
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Important**: Replace `your_anon_key_here` with your actual Supabase anonymous key from your Supabase dashboard.

**Troubleshooting**: If you encounter "Invalid API Key" errors, visit `/env-check` to verify your environment variables are set correctly. See [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md) for detailed setup instructions.

### Database Setup

1. Go to your Supabase dashboard → SQL Editor
2. Copy the contents of `supabase/migrations/001_initial_schema.sql`
3. Run the SQL migration to create all tables, RLS policies, and triggers
4. Enable real-time on the following tables in Supabase Dashboard → Database → Replication:
   - `tournament_players`
   - `user_rosters`
   - `roster_players`

### Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### For Users

1. **Sign Up/Login**: Create an account or sign in
2. **Browse Tournaments**: View available PGA Tour tournaments
3. **Create Roster**: Select up to 6 players for a tournament
4. **View Leaderboard**: See your personalized leaderboard with only your players
5. **Track Scores**: Watch real-time updates as your players compete

### For Admins

1. **Add Players**: Add PGA Tour players to the `pga_players` table
2. **Create Tournaments**: Create tournaments in the `tournaments` table
3. **Link Players to Tournaments**: Add players to `tournament_players` table
4. **Update Scores**: Use the admin scores page or API to update player scores
5. **Recalculate Points**: Trigger fantasy point recalculation after score updates

## Weekly Tournament Setup

Since you'll be uploading players weekly for each tournament:

1. **Add Players** (if new):
   ```sql
   INSERT INTO pga_players (name, country, world_ranking, is_active)
   VALUES ('Player Name', 'Country', 10, true);
   ```

2. **Create Tournament**:
   ```sql
   INSERT INTO tournaments (name, course, start_date, end_date, status)
   VALUES ('Tournament Name', 'Course Name', '2024-01-01', '2024-01-04', 'upcoming');
   ```

3. **Link Players to Tournament**:
   ```sql
   INSERT INTO tournament_players (tournament_id, pga_player_id)
   SELECT 'tournament-uuid', id FROM pga_players WHERE name IN ('Player 1', 'Player 2', ...);
   ```

## API Integration with LiveGolfAPI.com

To integrate with LiveGolfAPI.com for automatic score updates:

1. Create a cron job or scheduled function (e.g., using Vercel Cron)
2. Fetch tournament data from LiveGolfAPI.com
3. Transform the data to match the expected format
4. Call the `/api/scores/update` endpoint with the player scores

Example payload format:
```json
{
  "tournamentId": "uuid",
  "players": [
    {
      "pgaPlayerId": "uuid",
      "total_score": -10,
      "today_score": -3,
      "thru": 18,
      "position": 1,
      "made_cut": true,
      "round_1_score": -5,
      "round_2_score": -2
    }
  ]
}
```

## Project Structure

```
golfstats-supabase/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── auth/              # Authentication pages
│   │   ├── dashboard/         # User dashboard
│   │   ├── tournaments/       # Tournament pages
│   │   ├── players/           # Players browse page
│   │   ├── admin/             # Admin pages
│   │   └── api/               # API routes
│   ├── components/            # React components
│   │   ├── auth/              # Auth forms
│   │   ├── leaderboard/       # Leaderboard components
│   │   ├── roster/            # Roster management
│   │   ├── tournaments/       # Tournament components
│   │   ├── ui/                # Reusable UI components
│   │   └── layout/            # Layout components
│   └── lib/                   # Utilities and config
│       ├── supabase/          # Supabase clients
│       ├── types.ts           # TypeScript types
│       ├── scoring.ts         # Fantasy scoring logic
│       └── utils.ts           # Helper functions
├── supabase/
│   └── migrations/            # Database migrations
└── public/                    # Static assets
```

## Fantasy Scoring System

Points are awarded based on:
- **Position**: 1st (30pts), 2nd (25pts), 3rd (22pts), Top 5 (18pts), Top 10 (15pts), Top 20 (10pts)
- **Cut Status**: Made cut (+5pts), Missed cut (-5pts)
- **Performance**: Birdie (+1pt), Eagle (+3pts) - *requires detailed round data*

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

The app will be available at `https://your-app.vercel.app`

## Database Schema

Key tables:
- `profiles` - User profiles
- `pga_players` - PGA Tour players
- `tournaments` - PGA Tour tournaments
- `tournament_players` - Players in specific tournaments with scores
- `user_rosters` - User rosters for tournaments
- `roster_players` - Individual players in user rosters
- `scoring_rules` - Fantasy scoring rules

See `supabase/migrations/001_initial_schema.sql` for complete schema.

## Security

- Row Level Security (RLS) enabled on all tables
- Users can only view/edit their own rosters
- Public read access to tournaments and players
- Service role key used only in API routes (server-side only)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License

## Support

For issues or questions, please open an issue on GitHub.
