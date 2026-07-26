import { openai } from '../../config/openai.js';
import { CHAT_MODEL } from '../../config/constants.js';
import { getNotebookChunks } from '../ingestion/qdrantStore.js';

const MAX_CHARS = 60000;

const SYSTEM = `You design learning roadmaps from a set of source excerpts.

Return JSON shaped exactly like:
{"title": string, "summary": string, "steps": [{"title": string, "detail": string, "sourceTitle": string, "startSec": number|null, "estimatedMinutes": number}]}

Rules:
- Order steps so each one builds on the ones before it — prerequisites first.
- Base every step on the excerpts. Do not invent topics they do not cover.
- "sourceTitle" must be copied from a source the step draws on.
- "startSec" is the timestamp the step begins at when the source is a video, otherwise null.
- Aim for 5 to 12 steps.`;

export async function buildRoadmap(notebookId) {
  // Videos are what a roadmap is really for, but a notebook of PDFs still
  // deserves one rather than an error, so fall back to everything.
  let chunks = await getNotebookChunks(notebookId, { types: ['youtube', 'playlist'] });
  if (!chunks.length) chunks = await getNotebookChunks(notebookId);
  if (!chunks.length) {
    throw Object.assign(new Error('Index at least one source before building a roadmap'), {
      status: 400,
    });
  }

  let budget = MAX_CHARS;
  const excerpts = [];
  for (const chunk of chunks) {
    if (budget - chunk.text.length < 0) break;
    budget -= chunk.text.length;
    const stamp = chunk.position?.startSec !== undefined ? ` @${Math.floor(chunk.position.startSec)}s` : '';
    excerpts.push(`(${chunk.title}${stamp}) ${chunk.text}`);
  }

  const completion = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `Source excerpts:\n\n${excerpts.join('\n\n')}` },
    ],
  });

  const roadmap = JSON.parse(completion.choices[0].message.content);
  return { ...roadmap, generatedAt: new Date().toISOString() };
}
