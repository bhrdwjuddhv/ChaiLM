// Live end-to-end probe. NOT part of `npm test` — it spends real API credits.
//   node scripts/live-e2e.js [<youtube-url>]
//   SKIP_PODCAST=1 node scripts/live-e2e.js   (skip the expensive TTS step)
// Boots the app in-process, then drives the real upload → index → ask path.
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { connectDb } from '../src/config/db.js';
import { ensureCollection } from '../src/config/qdrant.js';
import { startIngestionWorker } from '../src/queues/ingestionWorker.js';
import { startPodcastWorker } from '../src/queues/podcastWorker.js';
import { redis } from '../src/config/redis.js';
import { ingestionQueue, podcastQueue } from '../src/queues/index.js';
import { assertEnv } from '../src/config/constants.js';

assertEnv();
await connectDb();
await ensureCollection();
const worker = startIngestionWorker();
const podcastWorker = startPodcastWorker();

const server = app.listen(0);
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}/api`;

const log = (...a) => console.log(...a);
let token;

const call = (path, { method = 'GET', body, raw } = {}) =>
  fetch(base + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(raw ? {} : { 'Content-Type': 'application/json' }),
    },
    body: raw || (body ? JSON.stringify(body) : undefined),
  });

const json = async (res) => {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { _status: res.status, _body: text.slice(0, 300) };
  }
};

// Minimal real PDF, built inline so this needs no fixture file.
function makePdf(pages) {
  const objects = [];
  const pageIds = pages.map((_, i) => 3 + i * 2);
  objects[1] = '<</Type/Catalog/Pages 2 0 R>>';
  objects[2] = `<</Type/Pages/Kids[${pageIds.map((id) => `${id} 0 R`).join(' ')}]/Count ${pages.length}>>`;
  pages.forEach((text, i) => {
    const pageId = pageIds[i];
    const stream = `BT /F1 12 Tf 20 100 Td (${text}) Tj ET`;
    objects[pageId] =
      `<</Type/Page/Parent 2 0 R/MediaBox[0 0 400 200]/Contents ${pageId + 1} 0 R` +
      `/Resources<</Font<</F1 <</Type/Font/Subtype/Type1/BaseFont/Helvetica>> >> >> >>`;
    objects[pageId + 1] = `<</Length ${stream.length}>>\nstream\n${stream}\nendstream`;
  });
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) {
    pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<</Size ${objects.length}/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

async function waitForIndex(sourceId, label) {
  for (let i = 0; i < 90; i++) {
    const source = await json(await call(`/sources/${sourceId}`));
    if (source.status === 'indexed') {
      log(`  ✔ ${label} indexed — ${source.chunkCount} chunks`);
      return source;
    }
    if (source.status === 'failed') {
      log(`  ✖ ${label} FAILED — ${source.error}`);
      return source;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  log(`  ✖ ${label} timed out still processing`);
  return null;
}

async function ask(notebookId, question) {
  const res = await fetch(`${base}/notebooks/${notebookId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ question }),
  });
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let done = null;
  for (;;) {
    const { value, done: finished } = await reader.read();
    if (finished) break;
    buffer += value;
    let split;
    while ((split = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      const event = frame.match(/^event: (.*)$/m)?.[1];
      const data = frame.match(/^data: (.*)$/m)?.[1];
      if (!data) continue;
      const parsed = JSON.parse(data);
      if (event === 'done') done = parsed;
      if (event === 'error') log('  ✖ chat error:', parsed.error);
    }
  }
  return done;
}

try {
  ({ token } = await json(
    await call('/auth/register', {
      method: 'POST',
      body: { name: 'E2E', email: `e2e${Date.now()}@example.com`, password: 'hunter2hunter2' },
    })
  ));
  assert.ok(token, 'registration failed');
  log('✔ registered');

  const notebook = await json(
    await call('/notebooks', { method: 'POST', body: { title: 'E2E notebook' } })
  );
  log(`✔ notebook ${notebook._id}`);

  // --- PDF upload ---
  log('\n[1] PDF upload → Cloudinary → index');
  const form = new FormData();
  form.append(
    'file',
    new Blob([makePdf(['The mitochondrion is the powerhouse of the cell.', 'Chloroplasts perform photosynthesis in plants.'])], {
      type: 'application/pdf',
    }),
    'biology.pdf'
  );
  const uploaded = await json(
    await call(`/notebooks/${notebook._id}/sources/upload`, { method: 'POST', raw: form })
  );
  if (!uploaded._id) {
    log('  ✖ upload rejected:', JSON.stringify(uploaded));
  } else {
    log(`  storageUrl: ${uploaded.storageUrl}`);
    const fetched = await fetch(uploaded.storageUrl);
    log(`  storageUrl fetchable: ${fetched.status} ${fetched.headers.get('content-type')}`);
    await waitForIndex(uploaded._id, 'PDF');
  }

  // --- Non-English captions: embedded as-is, answered in English ---
  log('\n[1b] Non-English VTT → index as-is');
  const spanishVtt = `WEBVTT

1
00:00:00.000 --> 00:00:06.000
El sistema solar tiene ocho planetas que giran alrededor del Sol.

2
00:00:06.000 --> 00:00:12.000
Júpiter es el planeta más grande y tiene una gran mancha roja.

3
00:00:12.000 --> 00:00:18.000
Marte se llama el planeta rojo por el óxido de hierro en su superficie.

4
00:00:18.000 --> 00:00:24.000
Saturno es famoso por sus anillos hechos de hielo y roca.
`;
  const vttForm = new FormData();
  vttForm.append('file', new Blob([spanishVtt], { type: 'text/vtt' }), 'planetas.vtt');
  let vtt = await json(
    await call(`/notebooks/${notebook._id}/sources/upload`, { method: 'POST', raw: vttForm })
  );
  if (!vtt._id) log('  ✖ upload rejected:', JSON.stringify(vtt));
  else {
    vtt = await waitForIndex(vtt._id, 'Spanish VTT');
    if (vtt?.status === 'indexed') {
      const stored = await json(await call(`/sources/${vtt._id}/chunks`));
      log(`  stored (original language): ${stored[0]?.text?.slice(0, 100)}`);
      log(`  position preserved: ${JSON.stringify(stored[0]?.position)}`);
    }
  }

  // --- YouTube ---
  const videoUrl = process.argv[2];
  let video;
  if (videoUrl) {
    log(`\n[2] YouTube ${videoUrl}`);
    video = await json(
      await call(`/notebooks/${notebook._id}/sources/paste`, {
        method: 'POST',
        body: { content: videoUrl },
      })
    );
    if (!video._id) log('  ✖ paste rejected:', JSON.stringify(video));
    else video = await waitForIndex(video._id, 'video');
  } else {
    log('\n[2] YouTube skipped — pass a video URL as argv[2]');
  }

  // --- Chat: English answer from non-English sources ---
  log('\n[3] Ask in English');
  for (const question of [
    'Which planet has a great red spot, and why is Mars red?',
    ...(video?.status === 'indexed' ? ['What is the video about?'] : []),
  ]) {
    log(`  Q: ${question}`);
    const done = await ask(notebook._id, question);
    log(`  A: ${(done?.content || '(no answer)').slice(0, 250)}`);
    log(`  citations: ${JSON.stringify(done?.citations?.map((c) => ({ type: c.sourceType, pos: c.position })) || [])}`);
  }

  // --- Podcast ---
  if (process.env.SKIP_PODCAST !== '1') {
    log('\n[4] Podcast (English, whole topic, stitched)');
    const started = await json(
      await call(`/notebooks/${notebook._id}/podcast`, { method: 'POST', body: { voice: 'female' } })
    );
    log(`  job ${started.jobId}`);
    for (let i = 0; i < 100; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const status = await json(await call(`/notebooks/${notebook._id}/podcast/${started.jobId}`));
      if (status.status === 'completed') {
        log(`  ✔ "${status.title}" — ${status.lineCount} lines, ${status.durationSec}s`);
        const head = await fetch(status.audioUrl);
        log(`  audio: ${head.status} ${head.headers.get('content-length')} bytes`);
        log(`  opening line: ${status.script?.[0]?.text?.slice(0, 110)}`);
        break;
      }
      if (status.status === 'failed') {
        log(`  ✖ podcast failed: ${status.error}`);
        break;
      }
      if (i % 4 === 0) log(`  …${status.status} ${status.progress || 0}%`);
    }
  }

  log('\nCleaning up…');
  await call(`/notebooks/${notebook._id}`, { method: 'DELETE' });
  log('✔ done');
} catch (err) {
  console.error('\nFATAL:', err);
} finally {
  server.close();
  await worker.close();
  await podcastWorker.close();
  await ingestionQueue.close();
  await podcastQueue.close();
  await mongoose.connection.close();
  redis.disconnect();
}
