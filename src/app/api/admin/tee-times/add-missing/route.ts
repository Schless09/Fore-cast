import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

const NICKNAME_MAP: Record<string, string[]> = {
  nico: ['nicolas'],
  nicolas: ['nico'],
  aj: ['a j'],
  'a j': ['aj'],
  cam: ['cameron'],
  cameron: ['cam'],
  zach: ['zachary', 'zack'],
  zachary: ['zach', 'zack'],
  john: ['johnny', 'jon'],
  johnny: ['john', 'jon'],
  mike: ['michael'],
  michael: ['mike'],
  matt: ['matthew'],
  matthew: ['matt'],
  dan: ['daniel', 'danny'],
  daniel: ['dan', 'danny'],
  nick: ['nicholas'],
  nicholas: ['nick'],
};

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\./g, '')
    .replace(/-/g, '')
    .replace(/ø/g, 'o')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/é/g, 'e')
    .replace(/á/g, 'a')
    .replace(/í/g, 'i')
    .replace(/\s+/g, ' ');
}

/**
 * Add missing players to a tournament field so tee times can be matched.
 * POST body: { tournamentId: string, names: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tournamentId, names } = body as { tournamentId?: string; names?: string[] };

    if (!tournamentId || !names || !Array.isArray(names) || names.length === 0) {
      return NextResponse.json(
        { error: 'tournamentId and names array required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    const { data: pgaPlayers, error: pgaError } = await supabase
      .from('pga_players')
      .select('id, name');

    if (pgaError) {
      return NextResponse.json({ error: pgaError.message }, { status: 500 });
    }

    const nameToPgaId = new Map<string, string>();
    for (const p of pgaPlayers ?? []) {
      const n = p.name as string;
      if (!n) continue;
      const norm = normalizeName(n);
      nameToPgaId.set(norm, p.id);
      const parts = norm.split(/\s+/);
      const first = parts[0] ?? '';
      const last = parts.slice(1).join(' ');
      // "Seung Taek Lee" (DB) -> also "seungtaek lee" so "Seungtaek Lee" (CSV) matches
      if (parts.length >= 3) {
        nameToPgaId.set(parts[0] + parts[1] + ' ' + parts.slice(2).join(' '), p.id);
      }
      const alts = NICKNAME_MAP[first];
      if (alts) {
        for (const alt of alts) {
          nameToPgaId.set(`${alt} ${last}`.trim(), p.id);
        }
      }
      if (parts.length >= 2) {
        nameToPgaId.set(`${last} ${first}`.trim(), p.id);
      }
    }

    const existing = new Set<string>();
    const { data: existingTp } = await supabase
      .from('tournament_players')
      .select('pga_player_id')
      .eq('tournament_id', tournamentId);
    for (const row of existingTp ?? []) {
      existing.add((row as { pga_player_id: string }).pga_player_id);
    }

    const addedNames: string[] = [];
    const notFound: string[] = [];

    for (const name of names) {
      const norm = normalizeName(name);
      let pgaPlayerId: string | undefined;

      if (nameToPgaId.has(norm)) {
        pgaPlayerId = nameToPgaId.get(norm);
      } else {
        const parts = norm.split(/\s+/);
        const first = parts[0] ?? '';
        const last = parts.slice(1).join(' ');
        const nicknames = NICKNAME_MAP[first] || [];
        for (const nick of nicknames) {
          const alt = `${nick} ${last}`.trim();
          if (nameToPgaId.has(alt)) {
            pgaPlayerId = nameToPgaId.get(alt);
            break;
          }
        }
        if (!pgaPlayerId && parts.length >= 2) {
          const swapped = `${last} ${first}`.trim();
          pgaPlayerId = nameToPgaId.get(swapped);
        }
      }

      if (!pgaPlayerId) {
        notFound.push(name);
        continue;
      }
      if (existing.has(pgaPlayerId)) {
        continue;
      }

      const { error: insertErr } = await supabase
        .from('tournament_players')
        .insert({
          tournament_id: tournamentId,
          pga_player_id: pgaPlayerId,
        });

      if (!insertErr) {
        existing.add(pgaPlayerId);
        addedNames.push(name);
      }
    }

    return NextResponse.json({
      added: addedNames.length,
      addedNames,
      notFound,
    });
  } catch (err) {
    console.error('[add-missing]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to add players' },
      { status: 500 }
    );
  }
}
