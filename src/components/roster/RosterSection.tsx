'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RosterBuilder } from './RosterBuilder';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface RosterPlayer {
  tournament_player?: {
    cost?: number;
    pga_player?: {
      name?: string;
      country?: string;
    };
  };
}

interface RosterSectionProps {
  tournamentId: string;
  tournamentStatus: 'upcoming' | 'active' | 'completed';
  existingRoster?: {
    id: string;
    roster_name: string;
    budget_spent: number;
    budget_limit: number;
    roster_players: RosterPlayer[];
    playerIds: string[];
  };
}

export function RosterSection({
  tournamentId,
  tournamentStatus,
  existingRoster,
}: RosterSectionProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(!existingRoster);

  const handleSave = () => {
    setIsEditing(false);
    // Refresh the page to get updated roster data
    router.refresh();
  };

  // No roster yet - show builder to create
  if (!existingRoster) {
    return (
      <RosterBuilder
        tournamentId={tournamentId}
      />
    );
  }

  // For active/completed tournaments, don't show edit option
  const canEdit = tournamentStatus === 'upcoming';

  // Show roster summary with edit option
  if (!isEditing) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Your Roster</CardTitle>
            {canEdit && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                ✏️ Edit Roster
              </Button>
            )}
          </div>
          {canEdit && (
            <p className="text-sm text-casino-green mt-2">
              💡 You can edit your roster until the tournament starts
            </p>
          )}
        </CardHeader>
        <CardContent>
          {/* Budget Summary */}
          <div className="flex items-center justify-between mb-4 p-3 bg-casino-dark/50 border border-casino-gold/20 rounded-lg">
            <span className="text-sm text-casino-gray">Budget Used</span>
            <span className="font-bold text-lg text-casino-gold">
              ${existingRoster.budget_spent?.toFixed(2) || '0.00'} / ${existingRoster.budget_limit?.toFixed(2) || '30.00'}
            </span>
          </div>

          {/* Player List - sorted by cost (most expensive first) */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-casino-gray mb-2">
              {existingRoster.roster_players?.length || 0} Players Selected
            </div>
            {[...(existingRoster.roster_players || [])]
              .sort((a, b) => (b.tournament_player?.cost || 0) - (a.tournament_player?.cost || 0))
              .map((rp, index) => {
              const player = rp.tournament_player?.pga_player;
              const cost = rp.tournament_player?.cost || 0;
              return (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-casino-dark/30 border border-casino-gold/10 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-casino-green/20 text-casino-green flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-casino-text">{player?.name || 'Unknown Player'}</div>
                      {player?.country && (
                        <div className="text-xs text-casino-gray">{player.country}</div>
                      )}
                    </div>
                  </div>
                  <div className="font-semibold text-casino-green">
                    ${cost.toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>

          {!canEdit && tournamentStatus === 'active' && (
            <div className="mt-4 p-3 bg-casino-gold/10 border border-casino-gold/30 rounded-lg text-sm text-casino-gold">
              🔒 Roster is locked - tournament is in progress
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Edit mode - show RosterBuilder
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-casino-text">Edit Your Roster</h2>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => setIsEditing(false)}
        >
          ← Cancel
        </Button>
      </div>
      <RosterBuilder
        tournamentId={tournamentId}
        existingRoster={{
          id: existingRoster.id,
          rosterName: existingRoster.roster_name,
          playerIds: existingRoster.playerIds,
        }}
        onSave={handleSave}
      />
    </div>
  );
}
