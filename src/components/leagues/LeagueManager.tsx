'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { JoinLeagueModal } from './JoinLeagueModal';
import { switchLeague, leaveLeague, createLeagueInvite, createTeamInvite, getTeamCoMembers, removeTeamCoMember, leaveCoManagerRole } from '@/lib/actions/league';

interface League {
  id: string;
  name: string;
  joined_at: string;
  is_commissioner?: boolean;
  member_count?: number;
  max_members?: number | null;
}

interface CoManagedTeam {
  id: string;
  leagueId: string;
  leagueName: string;
  ownerId: string;
  ownerUsername: string;
  createdAt: string;
}

interface LeagueManagerProps {
  initialLeagues: League[];
  initialActiveLeagueId: string | null;
  coManagedTeams?: CoManagedTeam[];
}

interface CoMember {
  id: string;
  co_member_id: string;
  username: string;
  email: string;
}

export function LeagueManager({ initialLeagues, initialActiveLeagueId, coManagedTeams = [] }: LeagueManagerProps) {
  const [showModal, setShowModal] = useState(false);
  const [activeLeagueId, setActiveLeagueId] = useState(initialActiveLeagueId);
  const [loading, setLoading] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState<string | null>(null);
  // Co-member state
  const [teamInviteUrl, setTeamInviteUrl] = useState<string | null>(null);
  const [showTeamInvite, setShowTeamInvite] = useState<string | null>(null);
  const [showCoMembers, setShowCoMembers] = useState<string | null>(null);
  const [coMembers, setCoMembers] = useState<CoMember[]>([]);
  const [loadingCoMembers, setLoadingCoMembers] = useState(false);
  const [removingCoMember, setRemovingCoMember] = useState<string | null>(null);
  const [copiedTeamInvite, setCopiedTeamInvite] = useState(false);
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

  const handleToggleCoMembers = async (leagueId: string) => {
    if (showCoMembers === leagueId) {
      // Close panel
      setShowCoMembers(null);
      setShowTeamInvite(null);
      setTeamInviteUrl(null);
      return;
    }

    // Open panel and fetch co-members
    setShowCoMembers(leagueId);
    setShowTeamInvite(null);
    setTeamInviteUrl(null);
    setLoadingCoMembers(true);

    const result = await getTeamCoMembers(leagueId);
    if (result.success) {
      setCoMembers(result.coMembers);
    }
    setLoadingCoMembers(false);
  };

  const handleGenerateTeamInvite = async (leagueId: string) => {
    setLoading(`team-${leagueId}`);
    const result = await createTeamInvite(leagueId);

    if (result.success && result.inviteUrl) {
      setTeamInviteUrl(result.inviteUrl);
      setShowTeamInvite(leagueId);
    } else {
      alert(result.error || 'Failed to generate team invite link');
    }
    setLoading(null);
  };

  const copyTeamInvite = async () => {
    if (!teamInviteUrl) return;
    try {
      await navigator.clipboard.writeText(teamInviteUrl);
      setCopiedTeamInvite(true);
      setTimeout(() => setCopiedTeamInvite(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = teamInviteUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedTeamInvite(true);
      setTimeout(() => setCopiedTeamInvite(false), 2000);
    }
  };

  const handleLeaveCoManagerRole = async (leagueId: string, ownerUsername: string) => {
    if (!confirm(`Are you sure you want to stop co-managing ${ownerUsername}'s team?`)) return;

    setLoading(`leave-co-${leagueId}`);
    const result = await leaveCoManagerRole(leagueId);
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error || 'Failed to leave co-manager role');
    }
    setLoading(null);
  };

  const handleRemoveCoMember = async (leagueId: string, coMemberId: string, username: string) => {
    if (!confirm(`Remove ${username} as a co-manager of your team?`)) return;

    setRemovingCoMember(coMemberId);
    const result = await removeTeamCoMember(leagueId, coMemberId);
    if (result.success) {
      setCoMembers((prev) => prev.filter((cm) => cm.co_member_id !== coMemberId));
    } else {
      alert(result.error || 'Failed to remove co-manager');
    }
    setRemovingCoMember(null);
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
                      className={`p-4 rounded-lg border-2 transition-all ${
                        isActive
                          ? 'border-casino-gold bg-casino-gold/10'
                          : 'border-casino-card hover:border-casino-gold/30'
                      }`}
                    >
                      {/* Top: Name, badges, meta */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {isActive && (
                            <span className="text-casino-gold text-xl shrink-0">⭐</span>
                          )}
                          <div>
                            <h3 className="font-bold text-casino-text flex items-center flex-wrap gap-2">
                              {league.name}
                              {league.is_commissioner && (
                                <span className="text-xs px-2 py-0.5 bg-casino-gold/20 text-casino-gold rounded-full font-normal">
                                  Commissioner
                                </span>
                              )}
                            </h3>
                            <p className="text-xs text-casino-gray mt-0.5">
                              Joined {new Date(league.joined_at).toLocaleDateString()}
                              {league.member_count !== undefined && (
                                <span className="ml-2">
                                  · {league.member_count}{league.max_members ? ` / ${league.max_members}` : ''} members
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        {isActive && (
                          <span className="text-xs px-3 py-1 bg-casino-gold/20 text-casino-gold rounded-full font-medium shrink-0 ml-3">
                            Active
                          </span>
                        )}
                      </div>

                      {/* Bottom: Actions */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {league.is_commissioner && (
                          <Link href={`/leagues/${league.id}/settings`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-casino-gold border-casino-gold/30 hover:bg-casino-gold/10 text-xs sm:text-sm"
                            >
                              Settings
                            </Button>
                          </Link>
                        )}
                        <Button
                          onClick={() => handleGenerateInvite(league.id)}
                          disabled={loading === league.id}
                          variant="outline"
                          size="sm"
                          className="text-casino-blue border-casino-blue/30 hover:bg-casino-blue/10 text-xs sm:text-sm"
                        >
                          Invite
                        </Button>
                        <Button
                          onClick={() => handleToggleCoMembers(league.id)}
                          variant="outline"
                          size="sm"
                          className="text-casino-green border-casino-green/30 hover:bg-casino-green/10 text-xs sm:text-sm"
                        >
                          {showCoMembers === league.id ? 'Close' : 'Invite Co-Manager'}
                        </Button>
                        {!isActive && (
                          <Button
                            onClick={() => handleSwitchLeague(league.id)}
                            disabled={loading === league.id}
                            variant="outline"
                            size="sm"
                            className="text-xs sm:text-sm"
                          >
                            {loading === league.id ? 'Switching...' : 'Switch To'}
                          </Button>
                        )}
                        <div className="ml-auto">
                          <Button
                            onClick={() => handleLeaveLeague(league.id, league.name)}
                            disabled={loading === league.id}
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300 text-xs sm:text-sm"
                          >
                            Leave
                          </Button>
                        </div>
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

                    {/* Co-Member Management Panel */}
                    {showCoMembers === league.id && (
                      <div className="mt-2 p-4 bg-casino-green/5 border border-casino-green/20 rounded-lg">
                        <h4 className="text-sm font-medium text-casino-text mb-1">
                          Team Co-Managers
                        </h4>
                        <p className="text-xs text-casino-gray mb-3">
                          Co-managers can view and edit your roster. They don&apos;t have their own team.
                        </p>

                        {/* Current co-members list */}
                        {loadingCoMembers ? (
                          <p className="text-xs text-casino-gray">Loading...</p>
                        ) : coMembers.length > 0 ? (
                          <div className="space-y-2 mb-3">
                            {coMembers.map((cm) => (
                              <div
                                key={cm.id}
                                className="flex items-center justify-between p-2 bg-casino-dark rounded"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-casino-text">
                                    {cm.username}
                                  </span>
                                  <span className="text-xs text-casino-gray">
                                    {cm.email}
                                  </span>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRemoveCoMember(league.id, cm.co_member_id, cm.username)}
                                  disabled={removingCoMember === cm.co_member_id}
                                  className="text-red-400 hover:text-red-300 text-xs"
                                >
                                  {removingCoMember === cm.co_member_id ? '...' : 'Remove'}
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-casino-gray mb-3">
                            No co-managers yet.
                          </p>
                        )}

                        {/* Generate team invite link */}
                        {showTeamInvite === league.id && teamInviteUrl ? (
                          <div className="space-y-2">
                            <label className="text-xs text-casino-gray">
                              Share this link with your co-manager:
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={teamInviteUrl}
                                readOnly
                                className="flex-1 px-3 py-2 bg-casino-dark border border-casino-green/30 rounded text-sm text-casino-text"
                              />
                              <Button size="sm" onClick={copyTeamInvite}>
                                {copiedTeamInvite ? 'Copied!' : 'Copy'}
                              </Button>
                            </div>
                            <p className="text-xs text-casino-gray">
                              Single-use link. Generate a new one if needed.
                            </p>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleGenerateTeamInvite(league.id)}
                            disabled={loading === `team-${league.id}`}
                            className="text-casino-green border-casino-green/30 hover:bg-casino-green/10"
                          >
                            {loading === `team-${league.id}` ? 'Generating...' : 'Generate Invite Link'}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Co-Managed Teams */}
      {coManagedTeams.length > 0 && (
        <Card className="mb-6 border-casino-green/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Teams You Co-Manage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {coManagedTeams.map((team) => (
                <div
                  key={team.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-lg border-2 border-casino-green/20 bg-casino-green/5 gap-3"
                >
                  <div>
                    <h3 className="font-bold text-casino-text">
                      {team.leagueName}
                      <span className="ml-2 text-xs px-2 py-0.5 bg-casino-green/20 text-casino-green rounded-full font-normal">
                        Co-Manager
                      </span>
                    </h3>
                    <p className="text-sm text-casino-gray mt-1">
                      Managing <strong className="text-casino-text">{team.ownerUsername}&apos;s</strong> team
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link href="/tournaments">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-casino-green border-casino-green/30 hover:bg-casino-green/10"
                      >
                        View Roster
                      </Button>
                    </Link>
                    <Button
                      onClick={() => handleLeaveCoManagerRole(team.leagueId, team.ownerUsername)}
                      disabled={loading === `leave-co-${team.leagueId}`}
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300"
                    >
                      {loading === `leave-co-${team.leagueId}` ? 'Leaving...' : 'Leave'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
