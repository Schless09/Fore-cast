import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import fs from 'fs/promises';
import path from 'path';

/**
 * Import player metadata (country, rankings, images)
 * Reads from player-metadata.json and updates database
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();

    // Read metadata file
    const metadataPath = path.join(
      process.cwd(),
      'src/app/admin/players/player-metadata.json'
    );
    const metadataContent = await fs.readFile(metadataPath, 'utf-8');
    const playerMetadata = JSON.parse(metadataContent);

    let updated = 0;
    let skipped = 0;

    for (const metadata of playerMetadata) {
      const { name, country, world_ranking, fedex_cup_ranking } = metadata;

      if (!name) {
        skipped++;
        continue;
      }

      // Find player by name (case-insensitive)
      const { data: players } = await supabase
        .from('pga_players')
        .select('id')
        .ilike('name', name)
        .limit(1);

      if (!players || players.length === 0) {
        console.warn(`Player not found for metadata update: ${name}`);
        skipped++;
        continue;
      }

      const playerId = players[0].id;

      // Generate UI Avatars URL
      const imageUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
        name
      )}&size=200&background=10b981&color=fff&bold=true`;

      // Update player with metadata
      const { error: updateError } = await supabase
        .from('pga_players')
        .update({
          country: country || null,
          world_ranking: world_ranking || null,
          fedex_cup_ranking: fedex_cup_ranking || null,
          image_url: imageUrl,
        })
        .eq('id', playerId);

      if (updateError) {
        console.error(`Error updating player ${name}:`, updateError);
        skipped++;
        continue;
      }

      updated++;
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${updated} players (${skipped} skipped)`,
      updated,
      skipped,
    });
  } catch (error: any) {
    console.error('Error importing player metadata:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to import metadata' },
      { status: 500 }
    );
  }
}
