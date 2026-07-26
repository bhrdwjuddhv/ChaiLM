import { fetchPlaylistVideoIds, fetchVideoSegments, fetchVideoTitle } from '../../../utils/youtube.js';

// Every video in the playlist is indexed under ONE source. `break: true` on each
// video's first unit stops a chunk from straddling two videos, which would make
// its start and end timestamps point at different videos.
export async function extract(source) {
  const { playlistId } = source.metadata;
  const { videoIds, title } = await fetchPlaylistVideoIds(playlistId);

  const units = [];
  const videos = [];

  for (const videoId of videoIds) {
    let segments;
    try {
      segments = await fetchVideoSegments(videoId);
    } catch {
      // One captionless video shouldn't sink the whole playlist.
      videos.push({ videoId, skipped: true });
      continue;
    }

    const videoTitle = await fetchVideoTitle(videoId).catch(() => null);
    videos.push({ videoId, title: videoTitle, durationSec: segments.at(-1).endSec });

    segments.forEach((s, i) => {
      units.push({
        text: s.text,
        break: i === 0,
        position: { videoId, videoTitle, startSec: s.startSec, endSec: s.endSec },
      });
    });
  }

  if (!units.length) throw new Error('No videos in this playlist had transcripts');

  return {
    units,
    metadata: {
      playlistId,
      videos,
      videoCount: videos.filter((v) => !v.skipped).length,
      skippedCount: videos.filter((v) => v.skipped).length,
    },
    title: title || source.title,
  };
}
