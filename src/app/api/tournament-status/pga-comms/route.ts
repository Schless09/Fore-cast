import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

const PGA_TOUR_COMMS_USER = 'PGATOURComms';
const MAX_ITEMS = 5;
const FETCH_TIMEOUT_MS = 4000;

const BLOCKED_PHRASES = ['rss reader', 'whitelist', 'not yet whitelisted', '403', 'forbidden', 'blocked'];

/**
 * Nitter instances. nitter.net has been confirmed working.
 * Set NITTER_BASE_URL in env to prefer a specific instance.
 */
const NITTER_INSTANCES = [
  process.env.NITTER_BASE_URL,
  'https://nitter.net',
  'https://nitter.poast.org',
  'https://xcancel.com',
  'https://nitter.privacyredirect.com',
  'https://nitter.tiekoetter.com',
].filter(Boolean) as string[];

/**
 * Alternative RSS sources with full URLs (RSSHub, etc.).
 * Add RSSHUB_BASE_URL in env to use a self-hosted RSSHub with Twitter.
 */
const ALTERNATIVE_RSS_URLS = [
  process.env.RSSHUB_BASE_URL
    ? `${process.env.RSSHUB_BASE_URL.replace(/\/$/, '')}/twitter/user/${PGA_TOUR_COMMS_USER}`
    : null,
].filter(Boolean) as string[];

interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

function isBlockedContent(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKED_PHRASES.some((p) => lower.includes(p));
}

function isValidPubDate(pubDate: string): boolean {
  if (!pubDate) return false;
  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) return false;
  const year = d.getFullYear();
  return year >= 2020 && year <= new Date().getFullYear() + 1;
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
      if (!title || !link) return;
      if (isBlockedContent(title) || isBlockedContent(description)) return;
      if (pubDate && !isValidPubDate(pubDate)) return;
      items.push({ title, link, description, pubDate });
    });
  } catch {
    // Ignore parse errors
  }
  return items;
}

async function fetchFromUrl(
  url: string,
  limit: number,
  sourceLabel: string
): Promise<{ items: RssItem[]; baseUrl: string } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const text = await res.text();
    if (!text.includes('<rss') && !text.includes('<feed')) return null;
    const items = parseRssXml(text).slice(0, limit);
    return items.length > 0 ? { items, baseUrl: sourceLabel } : null;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const limit = Math.min(
    parseInt(request.nextUrl.searchParams.get('limit') || String(MAX_ITEMS), 10) || MAX_ITEMS,
    10
  );

  const fetchPromises: Promise<{ items: RssItem[]; baseUrl: string } | null>[] = [
    ...NITTER_INSTANCES.map((baseUrl) =>
      fetchFromUrl(`${baseUrl.replace(/\/$/, '')}/${PGA_TOUR_COMMS_USER}/rss`, limit, baseUrl)
    ),
    ...ALTERNATIVE_RSS_URLS.map((url) => fetchFromUrl(url, limit, url)),
  ];

  const results = await Promise.all(fetchPromises);
  const succeeded = results.find((r): r is { items: RssItem[]; baseUrl: string } => r !== null);

  if (succeeded) {
    return NextResponse.json({
      items: succeeded.items,
      source: succeeded.baseUrl,
      account: `@${PGA_TOUR_COMMS_USER}`,
    });
  }

  return NextResponse.json(
    {
      items: [],
      account: `@${PGA_TOUR_COMMS_USER}`,
    },
    { status: 200 }
  );
}
