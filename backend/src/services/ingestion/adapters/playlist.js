import {
  fetchPlaylistVideoIds,
  fetchVideoSegments,
  fetchVideoTitle,
  transportSummary,
} from '../../../utils/youtube.js';

// Every video in the playlist is indexed under ONE source. `break: true` on each
// video's first unit stops a chunk from straddling two videos, which would make
// its start and end timestamps point at different videos.
//
// ponytail: videos are fetched one at a time. The failure this guards against is
// YouTube rate-limiting the host, and concurrency makes that strictly worse —
// raise it only if listing is fast and transcripts are the bottleneck.
// `deps` exists only so the skip/partial-success behaviour can be tested without
// the network; the pipeline always calls extract(source) with one argument.
export async function extract(source, deps = {}) {
  const {
    listVideos = fetchPlaylistVideoIds,
    getSegments = fetchVideoSegments,
    getTitle = fetchVideoTitle,
  } = deps;

  const { playlistId } = source.metadata;
  console.log(`[playlist] ${playlistId} starting — ${transportSummary()}`);

  const { videoIds, title } = await listVideos(playlistId);

  const units = [];
  const videos = [];

  for (const [i, videoId] of videoIds.entries()) {
    let segments;
    try {
      segments = await getSegments(videoId);
    } catch (err) {
      // One captionless or blocked video must not sink the whole playlist — but
      // the reason has to reach the logs, or a fully-blocked host looks like a
      // playlist where every video simply lacks captions.
      console.error(
        `[playlist] ${playlistId} video ${i + 1}/${videoIds.length} ${videoId} SKIPPED: ${err.message}`
      );
      videos.push({ videoId, skipped: true, error: err.message });
      continue;
    }

    const videoTitle = await getTitle(videoId).catch(() => null);
    console.log(
      `[playlist] ${playlistId} video ${i + 1}/${videoIds.length} ${videoId} ok — ` +
        `${segments.length} segments${videoTitle ? ` — ${videoTitle.slice(0, 60)}` : ''}`
    );
    videos.push({ videoId, title: videoTitle, durationSec: segments.at(-1).endSec });

    segments.forEach((s, idx) => {
      units.push({
        text: s.text,
        break: idx === 0,
        position: { videoId, videoTitle, startSec: s.startSec, endSec: s.endSec },
      });
    });
  }

  const skipped = videos.filter((v) => v.skipped);
  const indexed = videos.length - skipped.length;
  console.log(
    `[playlist] ${playlistId} done — ${indexed} indexed, ${skipped.length} skipped of ${videoIds.length}`
  );

  // Partial success is still success: fail only when nothing at all came back.
  if (!units.length) {
    const sample = skipped[0]?.error ? ` First error: ${skipped[0].error}` : '';
    throw new Error(
      `None of the ${videoIds.length} videos in this playlist returned a transcript.${sample}`
    );
  }

  return {
    units,
    metadata: {
      playlistId,
      videos,
      videoCount: indexed,
      skippedCount: skipped.length,
      skippedVideos: skipped.map((v) => ({ videoId: v.videoId, error: v.error })),
    },
    title: title || source.title,
  };
}
