// Check what tournaments exist and have data
const { createClient } = require('@supabase/supabase-js');

async function checkTournaments() {
  // Note: In production, this would need proper credentials
  console.log('Checking tournaments with data...');

  // Since we can't directly query Supabase, let's check via API
  console.log('Run these commands to debug:');
  console.log('');
  console.log('# Check which tournaments have prize money:');
  console.log('curl -s "http://localhost:3000/admin/prize-money" | grep -o \'"tournamentId":"[^"]*"\' | sort | uniq');
  console.log('');
  console.log('# Check tournament players count by tournament:');
  console.log('curl -X POST http://localhost:3000/api/scores/calculate-winnings -H "Content-Type: application/json" -d \'{"tournamentId":"LIST_ALL_TOURNAMENTS"}\'');
}

checkTournaments();