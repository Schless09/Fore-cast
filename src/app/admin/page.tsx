import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default async function AdminPage() {
  // Auth is handled by Clerk middleware
  // TODO: Add admin role check using Clerk roles

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">Manage tournaments, players, and scores</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Link href="/admin/tournaments">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>Tournaments</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm mb-4">
                Create and manage PGA Tour tournaments
              </p>
              <Button variant="outline" className="w-full">
                Manage Tournaments
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/players">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>Players</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm mb-4">
                Add and update PGA Tour players
              </p>
              <Button variant="outline" className="w-full">
                Manage Players
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/scores">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>Scores</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm mb-4">
                Update tournament scores and sync from API
              </p>
              <Button variant="outline" className="w-full">
                Update Scores
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/sync-tee-times">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>Sync Tee Times</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm mb-4">
                Fetch tee times and live scores from RapidAPI
              </p>
              <Button variant="outline" className="w-full">
                Sync Data
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/tee-times">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>Manually Set Tee Times</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm mb-4">
                Upload R1/R2 tee times from CSV (every Wednesday)
              </p>
              <Button variant="outline" className="w-full">
                Upload
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/odds">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>Odds & Costs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm mb-4">
                Import sportsbook odds and calculate player costs
              </p>
              <Button variant="outline" className="w-full">
                Update Odds
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/prize-money">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>Prize Money</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm mb-4">
                Import prize money distribution and calculate winnings
              </p>
              <Button variant="outline" className="w-full">
                Manage Prize Money
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/leagues">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>Leagues</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm mb-4">
                View all leagues and who created them
              </p>
              <Button variant="outline" className="w-full">
                View Leagues
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/rosters">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>View Rosters</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm mb-4">
                Debug and verify user rosters, players, and winnings
              </p>
              <Button variant="outline" className="w-full">
                View All Rosters
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/historical">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>Historical Data</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm mb-4">
                Import player historical performance (2015-2022)
              </p>
              <Button variant="outline" className="w-full">
                Import Historical Data
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/sync-rankings">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>Sync Rankings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm mb-4">
                Update world rankings and FedEx Cup standings
              </p>
              <Button variant="outline" className="w-full">
                Sync Rankings
              </Button>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
