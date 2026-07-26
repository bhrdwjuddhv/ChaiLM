import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';

const run = promisify(execFile);

// Buffer.concat leaves every segment's own Xing/Info duration header in the
// stream — measured: 3 parts in, 3 headers out, the first claiming the whole file
// is one segment long. ffmpeg's decoder rescans frames and reports the true
// length, but a browser <audio> element trusts that first header and stops early:
// the "podcast only plays a fragment" symptom. The concat demuxer emits exactly
// one header describing the whole file. Verified in test/stitch.test.js.
export async function stitchMp3(parts) {
  if (!parts.length) throw new Error('Nothing to stitch');
  if (parts.length === 1) return parts[0];

  const dir = await mkdtemp(path.join(tmpdir(), 'chaillm-podcast-'));
  try {
    const files = [];
    for (const [i, buffer] of parts.entries()) {
      const file = path.join(dir, `part-${String(i).padStart(4, '0')}.mp3`);
      await writeFile(file, buffer);
      files.push(file);
    }

    const listFile = path.join(dir, 'list.txt');
    // Paths are quoted and backslashes normalised — the concat demuxer parses
    // this file itself and chokes on Windows separators.
    await writeFile(listFile, files.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n'));

    const outFile = path.join(dir, 'podcast.mp3');
    await run(ffmpegPath, [
      '-hide_banner',
      '-loglevel', 'error',
      '-f', 'concat',
      '-safe', '0',
      '-i', listFile,
      '-c', 'copy',
      outFile,
    ]);

    return await readFile(outFile);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// Reads the real duration back so the job can prove it stitched the whole script.
export async function durationSeconds(buffer) {
  const dir = await mkdtemp(path.join(tmpdir(), 'chaillm-probe-'));
  try {
    const file = path.join(dir, 'audio.mp3');
    await writeFile(file, buffer);
    // ffmpeg writes its summary to stderr and exits non-zero with no output file.
    const { stderr } = await run(ffmpegPath, ['-hide_banner', '-i', file, '-f', 'null', '-']).catch(
      (e) => e
    );
    const match = /time=(\d+):(\d+):(\d+\.\d+)/g;
    let last = null;
    for (const m of String(stderr || '').matchAll(match)) last = m;
    if (!last) return null;
    return Number(last[1]) * 3600 + Number(last[2]) * 60 + Number(last[3]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
