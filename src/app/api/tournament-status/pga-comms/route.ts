import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

const PGA_TOUR_COMMS_USER = 'PGATOURComms';
const MAX_ITEMS = 5;
const FETCH_TIMEOUT_MS = 8000;

/**
 * Nitter instances (from https://github.com/zedeus/nitter/wiki/Instances).
 * Try in order; instances may block server requests or return 403.
 * Set NITTER_BASE_URL in env to prefer a specific instance.
 */
const NITTER_INSTANCES = [
  process.env.NITTER_BASE_URL,
  'https://nitter.poast.org',
  'https://xcancel.com',
  'https://nitter.privacyredirect.com',
  'https://nitter.tiekoetter.com',
].filter(Boolean) as string[];

interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

function parseRssXml(xml: string): RssItem[] {
  const items: RssItem[] = [];
  try {
    const $ = cheerio.load(xml, { xmlMode: true });
    $('item').each((_, el) => {
      const $el = $(el);
      const title = $el.find('title').text().trim();
      const link = $el.find('link').first().text().trim() || $el.find('link').next().text().trim();
      const description = $el.find('description').text().trim().replace(/<[^>]+>/g, '');
      const pubDate = $el.find('pubDate').text().trim();
      if (title && link) {
        items.push({ title, link, description, pubDate });
      }
    });
  } catch {
    // Ignore parse errors
  }
  return items;
}

export async function GET(request: NextRequest) {
  const limit = Math.min(
    parseInt(request.nextUrl.searchParams.get('limit') || String(MAX_ITEMS), 10) || MAX_ITEMS,
    10
  );

  for (const baseUrl of NITTER_INSTANCES) {
    try {
      const url = `${baseUrl.replace(/\/$/, '')}/${PGA_TOUR_COMMS_USER}/rss`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RSS reader; +https://github.com)',
          Accept: 'application/rss+xml, application/xml, text/xml, */*',
        },
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeout);

      if (!res.ok) continue;
      const text = await res.text();
      if (!text.includes('<rss') && !text.includes('<feed')) continue;
      const items = parseRssXml(text).slice(0, limit);
      if (items.length > 0) {
        return NextResponse.json({
          items,
          source: baseUrl,
          account: `@${PGA_TOUR_COMMS_USER}`,
        });
      }
    } catch {
      // Try next instance
      continue;
    }
  }

  return NextResponse.json(
    {
      items: [],
      message: 'Could not fetch from Nitter. Try again later or check @PGATOURComms on X.',
      account: `@${PGA_TOUR_COMMS_USER}`,
    },
    { status: 200 }
  );
}
