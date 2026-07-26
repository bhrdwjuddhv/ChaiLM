import { fetchVideoSegments, fetchVideoTitle } from '../../../utils/youtube.js';

export async function extract(source) {
  const { videoId } = source.metadata;
  const segments = await fetchVideoSegments(videoId);
  const title = await fetchVideoTitle(videoId).catch(() => null);

  return {
    units: segments.map((s) => ({
      text: s.text,
      position: { videoId, startSec: s.startSec, endSec: s.endSec },
    })),
    metadata: { videoId, durationSec: segments.at(-1).endSec },
    title: title || source.title,
  };
}
