import { fetchTranscript } from 'youtube-transcript';

const VIDEO_RE =
  /(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/;
const PLAYLIST_RE = /[?&]list=([\w-]+)/;
const URL_RE = /https?:\/\/[^\s<>"]+/gi;

export const parseVideoId = (input = '') => input.match(VIDEO_RE)?.[1] || null;
export const parsePlaylistId = (input = '') => input.match(PLAYLIST_RE)?.[1] || null;

// First YouTube link anywhere inside a blob of text, so a text source can still embed it.
export const findYoutubeLink = (text = '') =>
  (text.match(URL_RE) || []).find((url) => VIDEO_RE.test(url)) || null;

export async function fetchVideoTitle(videoId) {
  // oEmbed needs no API key.
  const res = await fetch(
    `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
  );
  if (!res.ok) return null;
  return (await res.json()).title ?? null;
}

// ponytail: scrapes the playlist page because no YOUTUBE_API_KEY exists in this
// project's env. Breaks if YouTube changes its markup — upgrade path is the
// YouTube Data API playlistItems endpoint.
export async function fetchPlaylistVideoIds(playlistId) {
  const res = await fetch(`https://www.youtube.com/playlist?list=${playlistId}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; chaiLLM/1.0)' },
  });
  if (!res.ok) throw new Error(`Could not fetch playlist (${res.status})`);
  const html = await res.text();

  const ids = [...html.matchAll(/"videoId":"([\w-]{11})"/g)].map((m) => m[1]);
  const unique = [...new Set(ids)];
  if (!unique.length) throw new Error('No videos found in this playlist (is it private?)');

  const title = html.match(/<title>([^<]*)<\/title>/)?.[1]?.replace(/ - YouTube$/, '').trim();
  return { videoIds: unique, title };
}

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
  const segments = await fetchTranscript(videoId);
  if (!segments?.length) throw new Error(`No transcript available for video ${videoId}`);
  return normalizeToSeconds(segments);
}
