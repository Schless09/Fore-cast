'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { JoinLeagueModal } from './JoinLeagueModal';
import { switchLeague, leaveLeague, createLeagueInvite } from '@/lib/actions/league';

interface League {
  id: string;
  name: string;
  joined_at: string;
  is_commissioner?: boolean;
}

interface LeagueManagerProps {
  initialLeagues: League[];
  initialActiveLeagueId: string | null;
}

export function LeagueManager({ initialLeagues, initialActiveLeagueId }: LeagueManagerProps) {
  const [showModal, setShowModal] = useState(false);
  const [activeLeagueId, setActiveLeagueId] = useState(initialActiveLeagueId);
  const [loading, setLoading] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState<string | null>(null);
  const router = useRouter();

  const handleSwitchLeague = async (leagueId: string) => {
    setLoading(leagueId);
    const result = await switchLeague(leagueId);
    
    if (result.success) {
      setActiveLeagueId(leagueId);
      router.refresh();
    }
    setLoading(null);
  };

  const handleLeaveLeague = async (leagueId: string, leagueName: string) => {
    if (!confirm(`Are you sure you want to leave "${leagueName}"? This cannot be undone.`)) {
      return;
    }

    setLoading(leagueId);
    const result = await leaveLeague(leagueId);
    
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error || 'Failed to leave league');
    }
    setLoading(null);
  };

  const handleGenerateInvite = async (leagueId: string) => {
    setLoading(leagueId);
    const result = await createLeagueInvite(leagueId);
    
    if (result.success && result.inviteUrl) {
      setInviteUrl(result.inviteUrl);
      setShowInvite(leagueId);
    } else {
      alert(result.error || 'Failed to generate invite link');
    }
    setLoading(null);
  };

  const copyToClipboard = () => {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl);
      alert('Invite link copied to clipboard!');
    }
  };

  return (
    <>
      {/* Current Leagues */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Your Leagues</CardTitle>
            <Button
              onClick={() => setShowModal(true)}
              variant="primary"
              size="sm"
            >
              + Join/Create League
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {initialLeagues.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-casino-gray mb-4">
                You&apos;re not in any leagues yet
              </p>
              <Button onClick={() => setShowModal(true)}>
                Join or Create a League
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {initialLeagues.map((league) => {
                const isActive = league.id === activeLeagueId;
                
                return (
                  <div key={league.id}>
                    <div
                      className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                        isActive
                          ? 'border-casino-gold bg-casino-gold/10'
                          : 'border-casino-card hover:border-casino-gold/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {isActive && (
                          <span className="text-casino-gold text-xl">⭐</span>
                        )}
                        <div>
                          <h3 className="font-bold text-casino-text">
                            {league.name}
                            {league.is_commissioner && (
                              <span className="ml-2 text-xs px-2 py-0.5 bg-casino-gold/20 text-casino-gold rounded-full font-normal">
                                Commissioner
                              </span>
                            )}
                          </h3>
                          <p className="text-xs text-casino-gray">
                            Joined {new Date(league.joined_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {league.is_commissioner && (
                          <Link href={`/leagues/${league.id}/settings`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-casino-gold border-casino-gold/30 hover:bg-casino-gold/10"
                            >
                              ⚙️ Settings
                            </Button>
                          </Link>
                        )}
                        <Button
                          onClick={() => handleGenerateInvite(league.id)}
                          disabled={loading === league.id}
                          variant="outline"
                          size="sm"
                          className="text-casino-blue border-casino-blue/30 hover:bg-casino-blue/10"
                        >
                          📨 Invite
                        </Button>
                        {!isActive && (
                          <Button
                            onClick={() => handleSwitchLeague(league.id)}
                            disabled={loading === league.id}
                            variant="outline"
                            size="sm"
                          >
                            {loading === league.id ? 'Switching...' : 'Switch To'}
                          </Button>
                        )}
                        {isActive && (
                          <span className="text-xs px-3 py-1 bg-casino-gold/20 text-casino-gold rounded-full font-medium">
                            Active
                          </span>
                        )}
                        <Button
                          onClick={() => handleLeaveLeague(league.id, league.name)}
                          disabled={loading === league.id}
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300"
                        >
                          Leave
                        </Button>
                      </div>
                    </div>
                    
                    {/* Show invite link if generated for this league */}
                    {showInvite === league.id && inviteUrl && (
                      <div className="mt-2 p-4 bg-casino-blue/10 border border-casino-blue/30 rounded-lg">
                        <p className="text-sm text-casino-text mb-2 font-medium">
                          Share this link with friends:
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={inviteUrl}
                            readOnly
                            className="flex-1 px-3 py-2 bg-casino-card border border-casino-gold/30 rounded text-sm text-casino-text"
                          />
                          <Button
                            onClick={copyToClipboard}
                            size="sm"
                            variant="primary"
                          >
                            Copy
                          </Button>
                        </div>
                        <p className="text-xs text-casino-gray mt-2">
                          Anyone with this link can join your league (if they have an account or create one)
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-casino-blue/30">
        <CardContent className="pt-6">
          <h3 className="font-bold text-casino-text mb-2">
            💡 About Leagues
          </h3>
          <ul className="space-y-2 text-sm text-casino-gray">
            <li>• You can be in multiple leagues simultaneously</li>
            <li>• Switch between leagues to view different standings</li>
            <li>• Each league has its own leaderboard and prizes</li>
            <li>• Your rosters are available across all leagues</li>
            <li>• Create a league to play with a new group of friends</li>
          </ul>
        </CardContent>
      </Card>

      {showModal && (
        <JoinLeagueModal
          onClose={() => {
            setShowModal(false);
            router.refresh();
          }}
          canClose={true}
        />
      )}
    </>
  );
}
