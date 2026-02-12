'use client';

import { useState, useMemo } from 'react';

type ViewColumn = 'tournaments' | 'standings_weekly' | 'standings_season';

type MemberRow = {
  rowKey: string;
  user_id: string;
  username: string;
  email: string;
  joined_at: string;
  is_commissioner: boolean;
  role: 'member' | 'co-manager';
  manages_team_of?: string;
  views: { tournaments: number; standings_weekly: number; standings_season: number };
};

function formatJoinDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function SortableHeader({
  label,
  sortKey,
  currentSort,
  sortDesc,
  onSort,
}: {
  label: string;
  sortKey: ViewColumn;
  currentSort: ViewColumn | null;
  sortDesc: boolean;
  onSort: (key: ViewColumn) => void;
}) {
  const isActive = currentSort === sortKey;
  return (
    <th
      className="px-2 sm:px-4 py-3 text-right cursor-pointer hover:text-casino-gold transition-colors select-none"
      title={label}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && <span className="text-casino-gold">{sortDesc ? '↓' : '↑'}</span>}
      </span>
    </th>
  );
}

export function SortableLeagueRoster({ members }: { members: MemberRow[] }) {
  const [sortBy, setSortBy] = useState<ViewColumn | null>(null);
  const [sortDesc, setSortDesc] = useState(true);

  const handleSort = (key: ViewColumn) => {
    if (sortBy === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(key);
      setSortDesc(true);
    }
  };

  const sortedMembers = useMemo(() => {
    if (!sortBy) return members;
    return [...members].sort((a, b) => {
      const va = a.views[sortBy];
      const vb = b.views[sortBy];
      const diff = va - vb;
      return sortDesc ? -diff : diff;
    });
  }, [members, sortBy, sortDesc]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-casino-gold/30 text-left text-casino-gray uppercase text-xs">
            <th className="px-2 sm:px-4 py-3">Username</th>
            <th className="px-2 sm:px-4 py-3 hidden sm:table-cell">Email</th>
            <th className="px-2 sm:px-4 py-3 hidden md:table-cell">Joined</th>
            <th className="px-2 sm:px-4 py-3 text-center">Role</th>
            <SortableHeader
              label="Tournaments"
              sortKey="tournaments"
              currentSort={sortBy}
              sortDesc={sortDesc}
              onSort={handleSort}
            />
            <SortableHeader
              label="Standings Weekly"
              sortKey="standings_weekly"
              currentSort={sortBy}
              sortDesc={sortDesc}
              onSort={handleSort}
            />
            <SortableHeader
              label="Standings Season"
              sortKey="standings_season"
              currentSort={sortBy}
              sortDesc={sortDesc}
              onSort={handleSort}
            />
          </tr>
        </thead>
        <tbody>
          {sortedMembers.map((member) => (
            <tr
              key={member.rowKey}
              className={`border-b border-casino-gold/10 transition-colors hover:bg-casino-elevated ${
                member.is_commissioner ? 'bg-casino-gold/5' : ''
              }`}
            >
              <td className="px-2 sm:px-4 py-3">
                <div className="flex flex-col">
                  <span className="font-medium text-casino-text">{member.username}</span>
                  <span className="text-xs text-casino-gray sm:hidden">{member.email}</span>
                </div>
              </td>
              <td className="px-2 sm:px-4 py-3 text-casino-gray hidden sm:table-cell">
                {member.email}
              </td>
              <td className="px-2 sm:px-4 py-3 text-casino-gray hidden md:table-cell">
                {formatJoinDate(member.joined_at)}
              </td>
              <td className="px-2 sm:px-4 py-3 text-center">
                {member.is_commissioner ? (
                  <span className="px-2 py-1 bg-casino-gold/20 text-casino-gold rounded text-xs font-medium">
                    Commissioner
                  </span>
                ) : member.role === 'co-manager' ? (
                  <span className="px-2 py-1 bg-casino-elevated text-casino-gray rounded text-xs" title={member.manages_team_of ? `Manages ${member.manages_team_of}'s team` : undefined}>
                    Co-Manager{member.manages_team_of ? ` (${member.manages_team_of})` : ''}
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-casino-elevated text-casino-gray rounded text-xs">
                    Member
                  </span>
                )}
              </td>
              <td className="px-2 sm:px-4 py-3 text-right text-casino-gray tabular-nums">
                {member.views.tournaments.toLocaleString()}
              </td>
              <td className="px-2 sm:px-4 py-3 text-right text-casino-gray tabular-nums">
                {member.views.standings_weekly.toLocaleString()}
              </td>
              <td className="px-2 sm:px-4 py-3 text-right text-casino-gray tabular-nums">
                {member.views.standings_season.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
