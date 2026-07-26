// WebVTT and SRT. Both are "index / timestamp line / text lines", separated by
// blank lines — one parser covers both.
const TIMESTAMP =
  /(\d{1,2}:)?(\d{1,2}):(\d{2})[.,](\d{1,3})\s*-->\s*(\d{1,2}:)?(\d{1,2}):(\d{2})[.,](\d{1,3})/;

const toSeconds = (h, m, s, ms) =>
  Number(h?.replace(':', '') || 0) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;

export function parseCues(raw) {
  const cues = [];
  const blocks = raw.replace(/\r\n/g, '\n').replace(/^WEBVTT.*\n/, '').split(/\n{2,}/);

  for (const block of blocks) {
    const lines = block.split('\n').filter(Boolean);
    const timeIndex = lines.findIndex((l) => TIMESTAMP.test(l));
    if (timeIndex === -1) continue;

    const [, h1, m1, s1, ms1, h2, m2, s2, ms2] = lines[timeIndex].match(TIMESTAMP);
    const text = lines
      .slice(timeIndex + 1)
      .join(' ')
      .replace(/<[^>]+>/g, '') // strip inline karaoke/styling tags
      .trim();
    if (!text) continue;

    cues.push({
      text,
      position: {
        startSec: toSeconds(h1, m1, s1, ms1),
        endSec: toSeconds(h2, m2, s2, ms2),
        cueIndex: cues.length,
      },
    });
  }
  return cues;
}

export async function extract(source) {
  const response = await fetch(source.storageUrl);
  if (!response.ok) throw new Error(`Could not fetch stored transcript (${response.status})`);

  const units = parseCues(await response.text());
  if (!units.length) throw new Error('No caption cues found in this file');

  return {
    units,
    metadata: { cueCount: units.length, durationSec: units.at(-1).position.endSec },
  };
}
