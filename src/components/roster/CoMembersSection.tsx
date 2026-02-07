'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { createTeamInvite, getTeamCoMembers, removeTeamCoMember } from '@/lib/actions/league';

interface CoMember {
  id: string;
  co_member_id: string;
  username: string;
  email: string;
  created_at: string;
}

interface CoMembersSectionProps {
  leagueId: string;
}

export function CoMembersSection({ leagueId }: CoMembersSectionProps) {
  const [coMembers, setCoMembers] = useState<CoMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchCoMembers = useCallback(async () => {
    const result = await getTeamCoMembers(leagueId);
    if (result.success) {
      setCoMembers(result.coMembers);
    }
    setLoading(false);
  }, [leagueId]);

  useEffect(() => {
    fetchCoMembers();
  }, [fetchCoMembers]);

  const handleGenerateInvite = async () => {
    setGenerating(true);
    try {
      const result = await createTeamInvite(leagueId);
      if (result.success && result.inviteUrl) {
        setInviteUrl(result.inviteUrl);
      } else {
        alert(result.error || 'Failed to create invite');
      }
    } catch (err) {
      console.error('Error generating invite:', err);
      alert('Failed to create invite');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = inviteUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRemove = async (coMemberId: string, username: string) => {
    if (!confirm(`Remove ${username} as a co-manager of your team?`)) return;
    
    setRemoving(coMemberId);
    try {
      const result = await removeTeamCoMember(leagueId, coMemberId);
      if (result.success) {
        setCoMembers((prev) => prev.filter((cm) => cm.co_member_id !== coMemberId));
      } else {
        alert(result.error || 'Failed to remove co-manager');
      }
    } catch (err) {
      console.error('Error removing co-manager:', err);
      alert('Failed to remove co-manager');
    } finally {
      setRemoving(null);
    }
  };

  return (
    <Card className="bg-casino-card border-casino-gold/20">
      <CardHeader>
        <CardTitle className="text-casino-gold text-base">
          Team Co-Managers
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-casino-gray mb-4">
          Co-managers can view and edit your roster. They don&apos;t have their own team in the league.
        </p>

        {/* Current co-members */}
        {loading ? (
          <p className="text-sm text-casino-gray">Loading...</p>
        ) : coMembers.length > 0 ? (
          <div className="space-y-2 mb-4">
            {coMembers.map((cm) => (
              <div
                key={cm.id}
                className="flex items-center justify-between p-2 bg-casino-dark rounded-lg"
              >
                <div>
                  <span className="text-sm font-medium text-casino-text">
                    {cm.username}
                  </span>
                  <span className="text-xs text-casino-gray ml-2">
                    {cm.email}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRemove(cm.co_member_id, cm.username)}
                  disabled={removing === cm.co_member_id}
                  className="text-red-400 hover:text-red-300 hover:bg-red-400/10 text-xs"
                >
                  {removing === cm.co_member_id ? 'Removing...' : 'Remove'}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-casino-gray mb-4">
            No co-managers yet. Generate an invite link to add one.
          </p>
        )}

        {/* Generate invite link */}
        {inviteUrl ? (
          <div className="space-y-2">
            <label className="text-xs text-casino-gray">
              Share this link with your co-manager:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteUrl}
                readOnly
                className="flex-1 px-3 py-2 bg-casino-dark border border-casino-gold/30 rounded text-sm text-casino-text"
              />
              <Button size="sm" onClick={handleCopy}>
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <p className="text-xs text-casino-gray">
              This is a single-use link. Generate a new one if needed.
            </p>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={handleGenerateInvite}
            disabled={generating}
          >
            {generating ? 'Generating...' : 'Generate Invite Link'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
