/**
 * Shared utilities for tee time parsing and player name matching.
 * Used by admin tee-times page and add-missing API.
 */

export const TEE_TIME_NICKNAME_MAP: Record<string, string[]> = {
  zach: ['zachary', 'zack'],
  zachary: ['zach', 'zack'],
  john: ['johnny', 'jon'],
  johnny: ['john', 'jon'],
  mike: ['michael'],
  michael: ['mike'],
  bob: ['robert', 'bobby'],
  robert: ['bob', 'bobby'],
  will: ['william', 'bill'],
  william: ['will', 'bill'],
  tom: ['thomas', 'tommy'],
  thomas: ['tom', 'tommy'],
  jim: ['james', 'jimmy'],
  james: ['jim', 'jimmy'],
  chris: ['christopher'],
  christopher: ['chris'],
  matt: ['matthew'],
  matthew: ['matt'],
  dan: ['daniel', 'danny'],
  daniel: ['dan', 'danny'],
  nick: ['nicholas'],
  nicholas: ['nick'],
  nico: ['nicolas'],
  nicolas: ['nico'],
  aj: ['a j'],
  'a j': ['aj'],
  jj: ['j j'],
  'j j': ['jj'],
  sh: ['s h'],
  's h': ['sh'],
  cam: ['cameron'],
  cameron: ['cam'],
};

export function normalizeTeeTimeName(name: string): string {
  return (name || '')
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

export function findTournamentPlayerId(
  csvName: string,
  nameToIdMap: Map<string, string>
): string | null {
  const normalized = normalizeTeeTimeName(csvName);
  if (nameToIdMap.has(normalized)) return nameToIdMap.get(normalized)!;

  const parts = normalized.split(/\s+/);
  const firstName = parts[0] ?? '';
  const lastName = parts.slice(1).join(' ');
  const nicknames = TEE_TIME_NICKNAME_MAP[firstName] || [];
  for (const nick of nicknames) {
    const altName = `${nick} ${lastName}`.trim();
    if (altName && nameToIdMap.has(altName)) return nameToIdMap.get(altName)!;
  }
  if (parts.length >= 2) {
    const swapped = `${lastName} ${firstName}`.trim();
    if (nameToIdMap.has(swapped)) return nameToIdMap.get(swapped)!;
  }
  return null;
}

export interface ParsedTeeTime {
  name: string;
  country: string;
  tee_time_r1: string | null;
  tee_time_r2: string | null;
  tee_time_r3: string | null;
  tee_time_r4: string | null;
  starting_tee_r1: number | null;
  starting_tee_r2: number | null;
}

/**
 * Parse pasted tee time data.
 * Supports: CSV (Player,R1_Time,R1_Tee_10,R2_Time,R2_Tee_10) or tab-separated with asterisk for tee 10.
 */
export function parseTeeTimeData(input: string): ParsedTeeTime[] {
  const lines = input.trim().split('\n');
  const results: ParsedTeeTime[] = [];

  const firstLine = lines[0]?.toLowerCase() || '';
  const isCSV = firstLine.includes('player') && (firstLine.includes('r1_time') || firstLine.includes(','));

  if (isCSV) {
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(',').map((p) => p.trim());
      if (parts.length < 5) continue;
      const [name, r1Time, r1Tee10, r2Time, r2Tee10] = parts;
      results.push({
        name,
        country: '',
        tee_time_r1: r1Time || null,
        tee_time_r2: r2Time || null,
        tee_time_r3: null,
        tee_time_r4: null,
        starting_tee_r1: r1Tee10?.toUpperCase() === 'TRUE' ? 10 : 1,
        starting_tee_r2: r2Tee10?.toUpperCase() === 'TRUE' ? 10 : 1,
      });
    }
  } else {
    let currentCountry = '';
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (line.toLowerCase().includes('ctry') && line.toLowerCase().includes('name')) continue;

      const parts = line.split(/\t+|\s{2,}/).map((p) => p.trim()).filter(Boolean);
      if (parts.length === 1) {
        currentCountry = parts[0];
        continue;
      }
      if (parts.length >= 2) {
        const firstPartIsCountry = /^[A-Z]{2,3}$/.test(parts[0]);
        let name: string;
        let r1: string | null = null;
        let r2: string | null = null;
        if (firstPartIsCountry) {
          currentCountry = parts[0];
          name = parts[1];
          r1 = parts[2] || null;
          r2 = parts[3] || null;
        } else {
          name = parts[0];
          r1 = parts[1] || null;
          r2 = parts[2] || null;
        }
        const parseTime = (time: string | null): { time: string | null; startingTee: number | null } => {
          if (!time) return { time: null, startingTee: null };
          const hasAsterisk = time.includes('*');
          const cleanTime = time.replace('*', '').trim();
          return { time: cleanTime || null, startingTee: hasAsterisk ? 10 : 1 };
        };
        const r1Parsed = parseTime(r1);
        const r2Parsed = parseTime(r2);
        results.push({
          name,
          country: currentCountry,
          tee_time_r1: r1Parsed.time,
          tee_time_r2: r2Parsed.time,
          tee_time_r3: null,
          tee_time_r4: null,
          starting_tee_r1: r1Parsed.startingTee,
          starting_tee_r2: r2Parsed.startingTee,
        });
      }
    }
  }
  return results;
}
