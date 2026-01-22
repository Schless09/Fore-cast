import { TournamentPlayer, PGAPlayer } from '@/lib/types';
import { formatScore, getScoreColor } from '@/lib/utils';
import { formatCurrency } from '@/lib/prize-money';

interface PlayerRowProps {
  player: TournamentPlayer & { pga_player?: PGAPlayer };
  playerWinnings: number;
  rank: number;
}

export function PlayerRow({ player, playerWinnings, rank }: PlayerRowProps) {
  const pgaPlayer = player.pga_player;
  const displayName = pgaPlayer?.name || 'Unknown Player';

  return (
    <tr className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
      <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-900">
        {rank}
      </td>
      <td className="px-2 sm:px-4 py-2 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-3">
          {pgaPlayer?.image_url ? (
            <img
              src={pgaPlayer.image_url}
              alt={displayName}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
              <span className="text-gray-500 text-xs sm:text-sm">
                {displayName.charAt(0)}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <p className="font-medium text-gray-900 text-xs sm:text-sm truncate">{displayName}</p>
            {pgaPlayer?.country && (
              <p className="text-xs text-gray-500 hidden sm:block">{pgaPlayer.country}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600">
        {player.position 
          ? `${player.is_tied && player.tied_with_count > 1 ? 'T' : ''}${player.position}` 
          : '-'}
      </td>
      <td className={`px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium ${getScoreColor(player.total_score)}`}>
        {formatScore(player.total_score)}
      </td>
      <td className={`px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm ${getScoreColor(player.today_score)} hidden sm:table-cell`}>
        {formatScore(player.today_score)}
      </td>
      <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 hidden md:table-cell">
        {player.thru || '-'}
      </td>
      <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right">
        <span className={`font-semibold ${playerWinnings > 0 ? 'text-green-600' : 'text-gray-500'}`}>
          {formatCurrency(playerWinnings)}
        </span>
      </td>
      <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-center hidden sm:table-cell">
        {player.made_cut ? (
          <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
            Cut
          </span>
        ) : (
          <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
            MC
          </span>
        )}
      </td>
    </tr>
  );
}
