import { fetchVideoSegments, fetchVideoTitle, transportSummary } from '../../../utils/youtube.js';

export async function extract(source) {
  const { videoId } = source.metadata;
  console.log(`[youtube] ${videoId} starting — ${transportSummary()}`);

  const segments = await fetchVideoSegments(videoId);
  const title = await fetchVideoTitle(videoId).catch(() => null);
  console.log(`[youtube] ${videoId} ok — ${segments.length} segments`);

  return {
    units: segments.map((s) => ({
      text: s.text,
      position: { videoId, startSec: s.startSec, endSec: s.endSec },
    })),
    metadata: { videoId, durationSec: segments.at(-1).endSec },
    title: title || source.title,
  };
}
