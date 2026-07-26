import { fetchTranscript } from 'youtube-transcript';
import { ProxyAgent } from 'undici';
import { YOUTUBE_PROXY_URL, YOUTUBE_API_KEY } from '../config/constants.js';

const VIDEO_RE =
  /(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/;
const PLAYLIST_RE = /[?&]list=([\w-]+)/;
const URL_RE = /https?:\/\/[^\s<>"]+/gi;

export const parseVideoId = (input = '') => input.match(VIDEO_RE)?.[1] || null;
export const parsePlaylistId = (input = '') => input.match(PLAYLIST_RE)?.[1] || null;

// First YouTube link anywhere inside a blob of text, so a text source can still embed it.
export const findYoutubeLink = (text = '') =>
  (text.match(URL_RE) || []).find((url) => VIDEO_RE.test(url)) || null;

// --- transport ---------------------------------------------------------------

// YouTube throttles and blocks datacenter IPs, so the same code that works from a
// laptop gets empty responses or 429s from a deploy host. A residential proxy is
// what actually gets through; a datacenter one usually will not. Optional, so
// local development is unchanged.
const dispatcher = YOUTUBE_PROXY_URL ? new ProxyAgent(YOUTUBE_PROXY_URL) : undefined;

export const usingProxy = Boolean(dispatcher);

const BROWSERISH = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

export const youtubeFetch = (url, init = {}) =>
  fetch(url, {
    ...init,
    headers: { ...BROWSERISH, ...init.headers },
    ...(dispatcher ? { dispatcher } : {}),
  });

// One line at startup of every playlist/video job so deploy logs say which path ran.
export const transportSummary = () =>
  `transport: ${usingProxy ? 'proxy (YOUTUBE_PROXY_URL)' : 'direct'}, ` +
  `playlist listing: ${YOUTUBE_API_KEY ? 'YouTube Data API' : 'page scrape'}, ` +
  `transcripts: youtube-transcript library (no external binary)`;

// --- metadata ----------------------------------------------------------------

export async function fetchVideoTitle(videoId) {
  // oEmbed needs no API key.
  const res = await youtubeFetch(
    `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
  );
  if (!res.ok) return null;
  return (await res.json()).title ?? null;
}

// --- playlist listing --------------------------------------------------------

// Official, paginated, and not IP-blocked the way the public playlist page is.
async function listViaDataApi(playlistId) {
  const ids = [];
  let pageToken = '';
  let title = null;

  do {
    const url =
      `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails,snippet` +
      `&maxResults=50&playlistId=${encodeURIComponent(playlistId)}&key=${YOUTUBE_API_KEY}` +
      (pageToken ? `&pageToken=${pageToken}` : '');

    const res = await youtubeFetch(url);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const reason = body?.error?.message || `HTTP ${res.status}`;
      throw new Error(`YouTube Data API rejected the playlist request: ${reason}`);
    }

    for (const item of body.items ?? []) {
      const id = item.contentDetails?.videoId;
      if (id) ids.push(id);
    }
    title ??= body.items?.[0]?.snippet?.channelTitle ?? null;
    pageToken = body.nextPageToken ?? '';
  } while (pageToken);

  return { videoIds: ids, title };
}

const decodeEntities = (s = '') =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

// ponytail: scraping the public playlist page needs no key but has two real
// limits. It only sees the ~100 videos in the page's first payload (the rest are
// lazy-loaded), and it is the part most likely to break on a deploy host, where
// YouTube serves datacenter IPs a page with no videoIds at all. Set
// YOUTUBE_API_KEY to use the official paginated listing instead.
async function listViaScrape(playlistId) {
  const res = await youtubeFetch(`https://www.youtube.com/playlist?list=${playlistId}`);
  if (!res.ok) throw new Error(`Could not fetch playlist page (HTTP ${res.status})`);
  const html = await res.text();

  const ids = [...new Set([...html.matchAll(/"videoId":"([\w-]{11})"/g)].map((m) => m[1]))];
  const title = decodeEntities(
    html.match(/<title>([^<]*)<\/title>/)?.[1]?.replace(/ - YouTube$/, '').trim() ?? ''
  );

  if (!ids.length) {
    const blocked = /consent\.youtube|captcha|unusual traffic|sign in to confirm/i.test(html);
    throw new Error(
      `Playlist page returned 0 videos (${html.length} bytes${blocked ? ', looks like a consent/captcha wall' : ''}). ` +
        'This is the usual symptom of YouTube blocking a datacenter IP — set YOUTUBE_API_KEY ' +
        'to list the playlist through the official API, or YOUTUBE_PROXY_URL to route around it.'
    );
  }
  return { videoIds: ids, title };
}

export async function fetchPlaylistVideoIds(playlistId) {
  const result = YOUTUBE_API_KEY ? await listViaDataApi(playlistId) : await listViaScrape(playlistId);

  const scraped = !YOUTUBE_API_KEY;
  console.log(
    `[youtube] playlist ${playlistId}: found ${result.videoIds.length} videos ` +
      `via ${scraped ? 'page scrape' : 'Data API'}`
  );
  // Exactly 100 from a scrape means the page's first payload was full and the
  // rest were never loaded, not that the playlist is 100 long.
  if (scraped && result.videoIds.length >= 100) {
    console.warn(
      `[youtube] playlist ${playlistId}: page scrape caps out around 100 videos — ` +
        'set YOUTUBE_API_KEY to index the whole playlist.'
    );
  }
  if (!result.videoIds.length) {
    throw new Error('No videos found in this playlist (is it private or empty?)');
  }
  return result;
}

// --- transcripts -------------------------------------------------------------

// youtube-transcript returns milliseconds from its srv3 parser and seconds from
// its classic parser, with nothing in the response saying which ran.
//
// Magnitude alone is not enough: "Me at the zoo" is 19s and reports 18881, which
// is well under any plausible ms threshold. The reliable tell is precision — the
// srv3 path emits integer milliseconds, while the classic path parses decimal
// second attributes ("1.36") and practically always yields fractions somewhere.
export function looksLikeMilliseconds(segments) {
  const maxEnd = Math.max(...segments.map((s) => s.offset + s.duration));
  if (maxEnd > 43200) return true; // >12h as seconds is impossible

  const allWhole = segments.every((s) => Number.isInteger(s.offset) && Number.isInteger(s.duration));
  // The floor keeps a genuinely short, whole-numbered classic transcript from
  // being divided down into milliseconds.
  return allWhole && maxEnd > 600;
}

function normalizeToSeconds(segments) {
  const divisor = looksLikeMilliseconds(segments) ? 1000 : 1;
  return segments.map((s) => ({
    text: s.text,
    startSec: s.offset / divisor,
    endSec: (s.offset + s.duration) / divisor,
  }));
}

export async function fetchVideoSegments(videoId) {
  // The library takes a custom fetch, which is how the proxy reaches it.
  const segments = await fetchTranscript(videoId, { fetch: youtubeFetch });
  if (!segments?.length) {
    throw new Error(
      `Transcript for ${videoId} came back empty — usually captions are disabled, ` +
        'or YouTube is serving this host a blank response (datacenter IP blocking).'
    );
  }
  return normalizeToSeconds(segments);
}
