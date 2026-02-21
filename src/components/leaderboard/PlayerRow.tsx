import { TournamentPlayer, PGAPlayer } from '@/lib/types';
import { formatScore, getScoreColor } from '@/lib/utils';
import { formatCurrency } from '@/lib/prize-money';

interface PlayerRowProps {
  player: TournamentPlayer & { pga_player?: PGAPlayer };
  playerWinnings: number;
  rank: number;
  currentRound?: number;
}

/**
 * Get the tee time to display based on the current round
 * Converts from EST to user's local timezone
 */
function getTeeTimeForRound(player: TournamentPlayer, currentRound?: number): string | null {
  let estTime: string | null = null;
  
  // For round 1 or before tournament starts, show R1 tee time
  if (!currentRound || currentRound === 1) {
    estTime = player.tee_time_r1 || player.tee_time;
  }
  // For round 2, show R2 tee time
  else if (currentRound === 2) {
    estTime = player.tee_time_r2 || player.tee_time;
  }
  // For rounds 3-4 (after cut), no scheduled tee times in our system
  else {
    estTime = player.tee_time;
  }
  
  // Convert EST to local timezone
  return estTime ?? null;
}

export function PlayerRow({ player, playerWinnings, rank, currentRound }: PlayerRowProps) {
  const pgaPlayer = player.pga_player;
  const displayName = pgaPlayer?.name || 'Unknown Player';

  return (
    <tr className="border-b border-casino-gold/10 hover:bg-casino-card/50 transition-colors">
      <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-casino-text">
        {rank}
      </td>
      <td className="px-2 sm:px-4 py-2 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-3">
          {pgaPlayer?.image_url ? (
            <img
              src={pgaPlayer.image_url}
              alt={displayName}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover shrink-0 border border-casino-gold/20"
            />
          ) : (
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shrink-0">
              <span className="text-white text-xs sm:text-sm font-bold">
                {displayName.charAt(0)}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <p className="font-medium text-casino-text text-xs sm:text-sm truncate">{displayName}</p>
            {pgaPlayer?.country && (
              <p className="text-xs text-casino-gray hidden sm:block">{pgaPlayer.country}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-casino-text">
        {player.made_cut === false ? (
          <span className="text-casino-red font-medium">MC</span>
        ) : player.position ? (
          `${player.is_tied && player.tied_with_count > 1 ? 'T' : ''}${player.position}`
        ) : (
          '-'
        )}
      </td>
      <td className={`px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium ${getScoreColor(player.total_score)}`}>
        {formatScore(player.total_score)}
      </td>
      <td className={`px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm ${getScoreColor(player.today_score)} hidden sm:table-cell`}>
        {formatScore(player.today_score)}
      </td>
      <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-casino-text hidden md:table-cell">
        {player.thru && player.thru !== 0 ? player.thru :
         getTeeTimeForRound(player, currentRound) || '-'}
      </td>
      <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right">
        <span className={`font-semibold ${playerWinnings > 0 ? 'text-casino-green' : 'text-casino-gray'}`}>
          {formatCurrency(playerWinnings)}
        </span>
      </td>
      <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-center hidden sm:table-cell">
        {player.made_cut === false ? (
          <span className="px-2 py-1 bg-casino-red/20 text-casino-red border border-casino-red/30 rounded-full text-xs font-medium">
            Cut
          </span>
        ) : (
          <span className="px-2 py-1 bg-casino-green/20 text-casino-green border border-casino-green/30 rounded-full text-xs font-medium">
            Active
          </span>
        )}
      </td>
    </tr>
  );
}
