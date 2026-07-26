import { openai } from '../../config/openai.js';
import { CHAT_MODEL, TTS_MODEL } from '../../config/constants.js';
import { getNotebookChunks } from '../ingestion/qdrantStore.js';
import { uploadBuffer } from '../../config/cloudinary.js';
import { stitchMp3, durationSeconds } from './stitch.js';

// One host and one guest, always opposite voices so the two are tellable apart.
// The requested voice belongs to the host.
const VOICES = {
  male: { host: 'onyx', guest: 'shimmer' },
  female: { host: 'nova', guest: 'echo' },
};

const MAP_CHARS = 14000; // per summarisation batch
const TTS_CONCURRENCY = 4;

// --- map: condense each slice of the notebook into key points ---------------

async function summarizeBatch(text) {
  const { choices } = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content:
          'Summarise the excerpts into a tight list of the key points, in English, whatever ' +
          'language the source is in. Facts, claims and definitions only — no preamble, no ' +
          'commentary. One point per line.',
      },
      { role: 'user', content: text },
    ],
  });
  return choices[0].message.content.trim();
}

// --- reduce: fold the key points into one ordered outline -------------------

async function buildOutline(summaries) {
  const { choices } = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You plan a short podcast episode. From the key points, produce JSON: ' +
          '{"title": string, "topics": [{"heading": string, "points": [string]}]}. ' +
          'Cover the whole subject, ordered so each topic follows from the last. ' +
          'Everything in English. 4 to 7 topics. Do not invent anything absent from the points.',
      },
      { role: 'user', content: summaries.join('\n\n') },
    ],
  });
  return JSON.parse(choices[0].message.content);
}

// --- script: turn the outline into a two-voice dialogue ---------------------

const SCRIPT_SYSTEM = `You write a two-speaker podcast script from an outline.

Return JSON shaped exactly like:
{"title": string, "lines": [{"speaker": "host"|"guest", "text": string}]}

Rules:
- Write ENTIRELY in English, whatever language the underlying material was in.
- Walk through every topic in the outline, in order. Do not stop after the first few.
- HOST introduces, asks and links topics together; GUEST explains. Alternate naturally.
- Open with a one-line welcome, close with a one-line sign-off.
- Plain spoken prose: no markdown, no bullets, no stage directions, no citation markers.
- One or two sentences per line — something a person says in a single breath.
- Cover the outline concisely. Stick to what the outline contains.`;

export async function buildScript(notebookId, onProgress) {
  const chunks = await getNotebookChunks(notebookId);
  if (!chunks.length) {
    throw Object.assign(new Error('Index at least one source before generating a podcast'), {
      status: 400,
    });
  }

  // Map: batch the notebook so a long one still fits, rather than truncating it
  // to the first N characters and podcasting only the opening slice.
  const batches = [];
  let current = '';
  for (const chunk of chunks) {
    const piece = `(${chunk.title}) ${chunk.text}\n\n`;
    if (current.length + piece.length > MAP_CHARS && current) {
      batches.push(current);
      current = '';
    }
    current += piece;
  }
  if (current) batches.push(current);

  const summaries = [];
  for (const [i, batch] of batches.entries()) {
    summaries.push(await summarizeBatch(batch));
    await onProgress?.((i + 1) / batches.length);
  }

  const outline = await buildOutline(summaries);

  const { choices } = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.6,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SCRIPT_SYSTEM },
      { role: 'user', content: `Outline:\n\n${JSON.stringify(outline, null, 2)}` },
    ],
  });

  const script = JSON.parse(choices[0].message.content);
  if (!script.lines?.length) throw new Error('The model returned an empty script');

  return { ...script, title: script.title || outline.title, outline, batchCount: batches.length };
}

// --- speech -----------------------------------------------------------------

export async function synthesize(lines, voice, onProgress) {
  const voices = VOICES[voice] || VOICES.female;
  const parts = new Array(lines.length);
  let finished = 0;

  const speak = async (index) => {
    const line = lines[index];
    const speech = await openai.audio.speech.create({
      model: TTS_MODEL,
      voice: line.speaker === 'host' ? voices.host : voices.guest,
      input: line.text,
      response_format: 'mp3',
    });
    parts[index] = Buffer.from(await speech.arrayBuffer());
    await onProgress?.(++finished / lines.length);
  };

  // Bounded parallelism: every line still lands at its own index, so order holds.
  const queue = lines.map((_, i) => i);
  await Promise.all(
    Array.from({ length: Math.min(TTS_CONCURRENCY, queue.length) }, async () => {
      for (let i = queue.shift(); i !== undefined; i = queue.shift()) await speak(i);
    })
  );

  if (parts.some((p) => !p)) throw new Error('Some lines produced no audio');
  return parts;
}

export async function generatePodcast({ notebookId, voice }, onProgress) {
  const script = await buildScript(notebookId, (ratio) => onProgress?.(ratio * 0.15));
  await onProgress?.(0.2);

  const parts = await synthesize(script.lines, voice, (ratio) => onProgress?.(0.2 + ratio * 0.6));

  const audio = await stitchMp3(parts);
  await onProgress?.(0.85);

  const duration = await durationSeconds(audio).catch(() => null);
  // ~150 spoken words a minute: a stitched file far shorter than the script means
  // the concat dropped segments, which is the bug this whole path exists to avoid.
  const words = script.lines.reduce((n, l) => n + l.text.split(/\s+/).length, 0);
  const expected = (words / 150) * 60;
  if (duration && duration < expected * 0.6) {
    throw new Error(
      `Stitched audio is ${Math.round(duration)}s but the script needs about ${Math.round(expected)}s — segments were lost`
    );
  }

  const uploaded = await uploadBuffer(audio, {
    folder: `chaillm/${notebookId}`,
    publicId: `podcast-${Date.now()}`,
    format: 'mp3',
  });
  await onProgress?.(1);

  console.log(
    `[podcast] ${notebookId}: ${script.lines.length} lines, ${words} words, ${Math.round(duration || 0)}s`
  );

  return {
    title: script.title,
    audioUrl: uploaded.secure_url,
    publicId: uploaded.public_id,
    voice,
    lineCount: script.lines.length,
    durationSec: duration ? Math.round(duration) : null,
    script: script.lines,
    generatedAt: new Date().toISOString(),
  };
}
