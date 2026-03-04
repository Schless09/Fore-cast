/**
 * CBS Sports leaderboard scrape for tee times, withdrawal detection, and replacement players.
 *
 * Logic: Compare our DB tournament_players to CBS tee time list.
 * - On CBS with tee time → sync tee times to DB (EST)
 * - In DB but not on CBS → mark withdrawn
 * - On CBS but not in DB → add as replacement (default cost; admin can update odds)
 *
 * Window: Tuesday afternoon through Thursday morning until tournament starts.
 * CBS tee times are published in EST; we store them as-is.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import { markPlayersWithdrawnAndNotify } from './withdrawals';

const CBS_LEADERBOARD_URL = 'https://www.cbssports.com/golf/leaderboard/';
const TIME_RE = /(\d{1,2}:\d{2}\s*[AP]M)/i;

/** Min match rate (0-1) to trust CBS: we must match this many of our DB players before syncing or marking WD */
const MIN_MATCH_RATE = 0.6;

/** Min CBS rows to consider the page valid (tournament tee times published) */
const MIN_CBS_ROWS = 50;

export function normalizeName(name: string): string {
  return (name || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ø/g, 'o')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/é/g, 'e')
    .replace(/á/g, 'a')
    .replace(/í/g, 'i')
    .replace(/å/g, 'a')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ');
}

/** Whether two player names refer to the same person (for duplicate detection) */
export function playerNamesMatch(a: string, b: string): boolean {
  const normA = TEE_TIME_NICKNAME_MAP[normalizeName(a)] ?? normalizeName(a);
  const normB = TEE_TIME_NICKNAME_MAP[normalizeName(b)] ?? normalizeName(b);
  if (normA === normB) return true;
  const partsA = normA.split(' ');
  const partsB = normB.split(' ');
  if (partsA.length < 2 || partsB.length < 2) return false;
  return (
    partsA[partsA.length - 1] === partsB[partsB.length - 1] &&
    (partsA[0] === partsB[0] || partsA[0].startsWith(partsB[0]) || partsB[0].startsWith(partsA[0]))
  );
}

export const TEE_TIME_NICKNAME_MAP: Record<string, string> = {
  'dan brown': 'daniel brown',
  'johnny keefer': 'john keefer',
  'matti schmid': 'matthias schmid',
  'matt kuchar': 'matthew kuchar',
  'jt poston': 'j.t. poston',
  'si woo kim': 'si-woo kim',
  'sung jae im': 'sungjae im',
  'byeong hun an': 'byeong-hun an',
  'k.h. lee': 'kyoung-hoon lee',
  'kh lee': 'kyoung-hoon lee',
  'ct pan': 'c.t. pan',
  'hj kim': 'h.j. kim',
  'st lee': 'seung taek lee',
  // CBS "Nico" / odds "Nicolas"; CBS "Frankie Capan" / odds "Frankie Capan III"
  'nico echavarria': 'nicolas echavarria',
  'frankie capan': 'frankie capan iii',
};

export interface CBSRow {
  name: string;
  r1: string;
  r2: string;
  back9R1?: boolean;
  back9R2?: boolean;
  /** True when CBS shows "(a)" for amateur (e.g. Daniel Bennett). Used to set pga_players.is_amateur. */
  isAmateur?: boolean;
}

/**
 * Parse CBS Sports leaderboard HTML for tee times (name, r1, r2).
 * Table structure: rows with optional flag, name (in link), r1 time, r2 time. Asterisk = back 9.
 */
export function parseCBSLeaderboardHTML(html: string): CBSRow[] {
  const $ = cheerio.load(html);
  const rows: CBSRow[] = [];

  $('table tbody tr').each((_, tr) => {
    const cells = $(tr).find('td');
    if (cells.length < 2) return;

    let nameCol = -1;
    let name = '';

    cells.each((i, el) => {
      const $el = $(el);
      const links = $el.find('a[href*="/golf/players/"]');
      if (links.length) {
        nameCol = i;
        // CBS uses .CellPlayerName--long for full name (Taylor Moore), .CellPlayerName--short for abbrev (T. Moore)
        const longLink = $el.find('.CellPlayerName--long a[href*="/golf/players/"]').first();
        const linkToUse = longLink.length ? longLink : links.first();
        const text = (linkToUse.attr('title') || linkToUse.text()).trim();
        const href = linkToUse.attr('href') || '';
        const slugMatch = href.match(/\/golf\/players\/[^/]+\/([^/]+)\/?$/);
        const slugName = slugMatch
          ? slugMatch[1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
          : '';
        name = (text || slugName).trim();
      }
    });

    if (nameCol < 0 || !name) return;

    const nameCellText = cells.eq(nameCol).text().trim();
    const isAmateur = /\(a\)/i.test(nameCellText);
    if (isAmateur) name = name.replace(/\s*\(a\)\s*$/i, '').trim() || name;

    const r1Cell = cells.eq(nameCol + 1);
    const r2Cell = cells.eq(nameCol + 2);
    const r1Text = r1Cell.text().trim();
    const r2Text = r2Cell.text().trim();
    const r1Match = r1Text.match(TIME_RE);
    const r2Match = r2Text.match(TIME_RE);

    const r1 = r1Match ? r1Match[1].replace(/\s+/g, ' ').trim() : '';
    const r2 = r2Match ? r2Match[1].replace(/\s+/g, ' ').trim() : '';
    const back9R1 = r1Text.includes('*');
    const back9R2 = r2Text.includes('*');

    if (r1 || r2) {
      rows.push({ name, r1, r2, back9R1, back9R2, isAmateur: isAmateur || undefined });
    }
  });

  return rows;
}

function findCbsRowForDbPlayer(dbName: string, cbsRowsByNorm: Map<string, CBSRow>): CBSRow | null {
  const norm = normalizeName(dbName);
  const lookup = TEE_TIME_NICKNAME_MAP[norm] ?? norm;
  const row = cbsRowsByNorm.get(lookup) ?? cbsRowsByNorm.get(norm);
  if (row) return row;
  // Reverse alias: CBS "dan brown" should match DB "daniel brown"
  for (const [alias, canonical] of Object.entries(TEE_TIME_NICKNAME_MAP)) {
    if (canonical === lookup) {
      const r = cbsRowsByNorm.get(alias);
      if (r) return r;
    }
  }
  const parts = lookup.split(' ');
  const last = parts[parts.length - 1];
  const first = parts[0];
  for (const [cbsNorm, r] of cbsRowsByNorm.entries()) {
    const cbsParts = cbsNorm.split(' ');
    if (
      cbsParts[cbsParts.length - 1] === last &&
      (cbsParts[0] === first || cbsParts[0].startsWith(first) || first.startsWith(cbsParts[0]))
    ) {
      return r;
    }
  }
  return null;
}

/** Check if CBS row matches any existing tournament player by name (avoids duplicate inserts) */
function cbsRowMatchesExistingPlayer(
  cbsRow: CBSRow,
  tournamentPlayers: { pga_player_id: string | null }[],
  nameByPgaId: Map<string, string>,
  cbsRowsByNorm: Map<string, CBSRow>
): boolean {
  for (const tp of tournamentPlayers) {
    const name = tp.pga_player_id ? nameByPgaId.get(tp.pga_player_id) : null;
    if (!name) continue;
    const found = findCbsRowForDbPlayer(name, cbsRowsByNorm);
    if (found === cbsRow) return true;
  }
  return false;
}

/**
 * Whether we're in the pre-tournament window: Tuesday through Thursday morning
 * until the tournament starts. CBS publishes tee times Wed; we run Tue–Thu.
 */
export function isInPreTournamentWindow(
  tournament: { start_date: string },
  now: Date
): boolean {
  const start = new Date(tournament.start_date + 'T00:00:00-05:00');
  const daysUntil = (start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  const dow = now.getUTCDay(); // 0=Sun, 2=Tue, 3=Wed, 4=Thu
  // Tue, Wed, Thu only; tournament starts within 2 days
  const inWindow = (dow === 2 || dow === 3 || dow === 4) && daysUntil >= 0 && daysUntil <= 2;
  return inWindow;
}

export interface SyncTeeTimesAndWithdrawalsResult {
  success: boolean;
  message: string;
  teeTimesMatched: number;
  replacementsAdded: number;
  withdrawnCount: number;
  emailsSent: number;
  /** Names of players marked withdrawn (no longer in CBS field) */
  withdrawnPlayerNames?: string[];
  skipped?: string;
  /** Diagnostic info when skipped */
  debug?: { cbsRows: number; matched: number; totalDb: number; matchRatePct: number };
}

/** Build map: normalized name -> pga_player_id for matching CBS names. */
function buildPgaNameToIdMap(pgaPlayers: { id: string; name: string | null }[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const p of pgaPlayers) {
    const n = (p.name ?? '').trim();
    if (!n) continue;
    const norm = normalizeName(n);
    map.set(norm, p.id);
    const canon = TEE_TIME_NICKNAME_MAP[norm] ?? norm;
    map.set(canon, p.id);
    for (const [alias, canonical] of Object.entries(TEE_TIME_NICKNAME_MAP)) {
      if (canonical === norm) map.set(alias, p.id);
    }
    const parts = norm.split(' ');
    if (parts.length >= 2) {
      map.set(`${parts[parts.length - 1]} ${parts[0]}`, p.id);
    }
  }
  return map;
}

/** Resolve CBS name to pga_player_id using pre-built map. */
function resolveCbsNameToPgaId(
  cbsName: string,
  pgaMap: Map<string, string>
): string | null {
  const norm = normalizeName(cbsName);
  const lookup = TEE_TIME_NICKNAME_MAP[norm] ?? norm;
  if (pgaMap.has(lookup) || pgaMap.has(norm)) return pgaMap.get(lookup) ?? pgaMap.get(norm) ?? null;
  const parts = lookup.split(' ');
  const last = parts[parts.length - 1];
  const first = parts[0];
  for (const [dbNorm, id] of pgaMap.entries()) {
    const dbParts = dbNorm.split(' ');
    if (
      dbParts[dbParts.length - 1] === last &&
      (dbParts[0] === first || dbParts[0].startsWith(first) || first.startsWith(dbParts[0]))
    ) {
      return id;
    }
  }
  return null;
}

/**
 * Fetch CBS leaderboard, sync R1/R2 tee times for DB players on CBS, mark WD for DB players not on CBS.
 * Only runs when CBS has enough rows and match rate is high enough.
 */
export async function syncTeeTimesAndWithdrawalsFromCBS(
  supabase: SupabaseClient,
  tournament: { id: string; name: string }
): Promise<SyncTeeTimesAndWithdrawalsResult> {
  try {
    const response = await fetch(CBS_LEADERBOARD_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        success: false,
        message: `CBS returned ${response.status}`,
        teeTimesMatched: 0,
        replacementsAdded: 0,
        withdrawnCount: 0,
        emailsSent: 0,
      };
    }

    const html = await response.text();
    const cbsRows = parseCBSLeaderboardHTML(html);

    if (cbsRows.length < MIN_CBS_ROWS) {
      return {
        success: true,
        message: `CBS has ${cbsRows.length} rows (need ${MIN_CBS_ROWS}+); tee times not yet published`,
        teeTimesMatched: 0,
        replacementsAdded: 0,
        withdrawnCount: 0,
        emailsSent: 0,
        skipped: 'CBS row count too low',
        debug: { cbsRows: cbsRows.length, matched: 0, totalDb: 0, matchRatePct: 0 },
      };
    }

    const cbsRowsByNorm = new Map<string, CBSRow>();
    for (const row of cbsRows) {
      const norm = normalizeName(row.name);
      const lookup = TEE_TIME_NICKNAME_MAP[norm] ?? norm;
      cbsRowsByNorm.set(lookup, row);
      cbsRowsByNorm.set(norm, row);
    }

    // Fetch tournament_players (withdrawn from migration 051)
    let tournamentPlayers: { id: string; pga_player_id: string | null; withdrawn?: boolean }[] | null;
    let tpError: { message: string } | null = null;
    const withWithdrawn = await supabase
      .from('tournament_players')
      .select('id, pga_player_id, withdrawn')
      .eq('tournament_id', tournament.id);
    if (withWithdrawn.error?.message?.includes('withdrawn')) {
      // Fallback: withdrawn column missing (migration 051 not applied)
      const fallback = await supabase
        .from('tournament_players')
        .select('id, pga_player_id')
        .eq('tournament_id', tournament.id);
      tournamentPlayers = fallback.data;
      tpError = fallback.error;
    } else {
      tournamentPlayers = withWithdrawn.data;
      tpError = withWithdrawn.error;
    }

    if (tpError || !tournamentPlayers?.length) {
      return {
        success: false,
        message: `No tournament players in DB for ${tournament.name} (run odds import first)`,
        teeTimesMatched: 0,
        replacementsAdded: 0,
        withdrawnCount: 0,
        emailsSent: 0,
        skipped: 'No tournament players',
        debug: { cbsRows: cbsRows.length, matched: 0, totalDb: 0, matchRatePct: 0 },
      };
    }

    // Batch-fetch player names (avoids pga_players embed which can fail)
    const pgaIds = [...new Set(tournamentPlayers.map((tp) => tp.pga_player_id).filter(Boolean))];
    const { data: pgaRows } = await supabase
      .from('pga_players')
      .select('id, name')
      .in('id', pgaIds);
    const nameByPgaId = new Map<string, string>();
    for (const p of pgaRows ?? []) {
      if (p.name) nameByPgaId.set(p.id, p.name);
    }

    const nonWithdrawn = tournamentPlayers.filter((tp) => !tp.withdrawn);
    const matched: { tp: (typeof tournamentPlayers)[0]; row: CBSRow }[] = [];
    const unmatched: (typeof tournamentPlayers)[0][] = [];

    for (const tp of nonWithdrawn) {
      const name = tp.pga_player_id ? nameByPgaId.get(tp.pga_player_id) : null;
      if (!name) continue;
      const row = findCbsRowForDbPlayer(name, cbsRowsByNorm);
      if (row) matched.push({ tp, row });
      else unmatched.push(tp);
    }

    const matchRate = nonWithdrawn.length > 0 ? matched.length / nonWithdrawn.length : 0;
    if (matchRate < MIN_MATCH_RATE) {
      return {
        success: true,
        message: `Match rate ${(matchRate * 100).toFixed(0)}% (${matched.length}/${nonWithdrawn.length}) below ${MIN_MATCH_RATE * 100}%; name mismatch?`,
        teeTimesMatched: 0,
        replacementsAdded: 0,
        withdrawnCount: 0,
        emailsSent: 0,
        skipped: 'Low match rate',
        debug: { cbsRows: cbsRows.length, matched: matched.length, totalDb: nonWithdrawn.length, matchRatePct: Math.round(matchRate * 100) },
      };
    }

    // Build set of pga_player_ids already in this tournament (incl. withdrawn)
    const existingPgaIds = new Set(
      tournamentPlayers.map((tp) => tp.pga_player_id).filter(Boolean)
    );

    // Add replacements: on CBS but not in our DB (alternates who got in)
    // Skip if CBS name matches an existing tournament player (avoids duplicates from spelling variants)
    const { data: pgaPlayers } = await supabase.from('pga_players').select('id, name');
    const pgaMap = buildPgaNameToIdMap(pgaPlayers ?? []);
    let replacementsAdded = 0;
    const defaultCost = 2.5;

    for (const row of cbsRows) {
      const pgaId = resolveCbsNameToPgaId(row.name, pgaMap);
      if (!pgaId || existingPgaIds.has(pgaId)) continue;
      if (cbsRowMatchesExistingPlayer(row, tournamentPlayers, nameByPgaId, cbsRowsByNorm)) continue;

      const { error: insertErr } = await supabase.from('tournament_players').insert({
        tournament_id: tournament.id,
        pga_player_id: pgaId,
        cost: defaultCost,
        withdrawn: false,
      });
      if (!insertErr) {
        existingPgaIds.add(pgaId);
        replacementsAdded++;
        if (row.r1 || row.r2) {
          await supabase
            .from('tournament_players')
            .update({
              tee_time_r1: row.r1 || null,
              tee_time_r2: row.r2 || null,
              starting_tee_r1: row.back9R1 ? 10 : 1,
              starting_tee_r2: row.back9R2 ? 10 : 1,
            })
            .eq('tournament_id', tournament.id)
            .eq('pga_player_id', pgaId);
        }
        if (row.isAmateur) {
          await supabase.from('pga_players').update({ is_amateur: true }).eq('id', pgaId);
        }
      }
    }

    // Sync tee times and amateur status for matched players (CBS times are EST)
    let teeTimesMatched = 0;
    for (const { tp, row } of matched) {
      const updateData: Record<string, string | number | null> = {};
      if (row.r1) {
        updateData.tee_time_r1 = row.r1;
        updateData.starting_tee_r1 = row.back9R1 ? 10 : 1;
      }
      if (row.r2) {
        updateData.tee_time_r2 = row.r2;
        updateData.starting_tee_r2 = row.back9R2 ? 10 : 1;
      }
      if (Object.keys(updateData).length > 0) {
        const { error } = await supabase
          .from('tournament_players')
          .update(updateData)
          .eq('id', tp.id);
        if (!error) teeTimesMatched++;
      }
      if (row.isAmateur && tp.pga_player_id) {
        await supabase.from('pga_players').update({ is_amateur: true }).eq('id', tp.pga_player_id);
      }
    }

    // Mark WD for unmatched players
    let withdrawnCount = 0;
    let emailsSent = 0;
    const withdrawnPlayerNames: string[] = [];
    if (unmatched.length > 0) {
      const pgaIds = unmatched.map((tp) => tp.pga_player_id).filter((id): id is string => !!id);
      for (const tp of unmatched) {
        const name = tp.pga_player_id ? nameByPgaId.get(tp.pga_player_id) : null;
        if (name) withdrawnPlayerNames.push(name);
      }
      const result = await markPlayersWithdrawnAndNotify(supabase, tournament.id, pgaIds);
      withdrawnCount = result.withdrawnCount;
      emailsSent = result.emailsSent;
    }

    return {
      success: true,
      message: `CBS: ${teeTimesMatched} tee times, ${replacementsAdded} replacements, ${withdrawnCount} WD, ${emailsSent} emails`,
      teeTimesMatched,
      replacementsAdded,
      withdrawnCount,
      emailsSent,
      withdrawnPlayerNames: withdrawnPlayerNames.length > 0 ? withdrawnPlayerNames : undefined,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: msg,
      teeTimesMatched: 0,
      replacementsAdded: 0,
      withdrawnCount: 0,
      emailsSent: 0,
    };
  }
}
