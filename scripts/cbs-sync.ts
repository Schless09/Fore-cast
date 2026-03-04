/**
 * One-off script to run CBS leaderboard sync (tee times + amateur flags).
 * Run from project root with env loaded, e.g.:
 *   npx tsx scripts/cbs-sync.ts
 * Or: node --env-file=.env.local --import tsx scripts/cbs-sync.ts
 */
import { createClient } from '@supabase/supabase-js';
import { syncTeeTimesAndWithdrawalsFromCBS } from '../src/lib/cbs-tee-times';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set in .env.local or shell.');
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  const { data: tournaments, error } = await supabase
    .from('tournaments')
    .select('id, name, start_date, status')
    .in('status', ['upcoming', 'active'])
    .order('start_date', { ascending: true })
    .limit(5);

  if (error) {
    console.error('Failed to fetch tournaments:', error.message);
    process.exit(1);
  }

  if (!tournaments?.length) {
    console.log('No upcoming/active tournaments found.');
    process.exit(0);
  }

  console.log('Tournaments:', tournaments.map((t) => `${t.name} (${t.id})`).join('\n'));
  const tournament = tournaments[0];
  console.log('\nRunning CBS sync for:', tournament.name, '...\n');

  const result = await syncTeeTimesAndWithdrawalsFromCBS(supabase, tournament);

  console.log('CBS sync result:', result.message);
  if (result.skipped) console.log('Skipped:', result.skipped);
  if (result.teeTimesMatched != null) console.log('Tee times matched:', result.teeTimesMatched);
  if (result.replacementsAdded != null) console.log('Replacements added:', result.replacementsAdded);
  if (result.withdrawnCount != null) console.log('Withdrawn:', result.withdrawnCount);
  if (result.withdrawnPlayerNames?.length) console.log('Withdrawn names:', result.withdrawnPlayerNames);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
