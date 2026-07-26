import { openai } from '../../config/openai.js';
import { CHAT_MODEL } from '../../config/constants.js';
import { embedQuery } from '../ingestion/embedder.js';
import { searchChunks } from '../ingestion/qdrantStore.js';

const TOP_K = 8;

export async function retrieve(notebookId, question) {
  // Same model as ingestion (EMBEDDING_MODEL) — a query embedded with a different
  // model lands in a different space and matches nothing.
  const vector = await embedQuery(question);
  const hits = await searchChunks({ notebookId, vector, limit: TOP_K });

  console.log(
    `[rag] notebook=${notebookId} hits=${hits.length}`,
    hits.map((h) => `${h.sourceType}:${h.score.toFixed(3)}`).join(' ')
  );
  return hits;
}

const SYSTEM = `You are a research assistant answering strictly from the numbered sources below.

Rules:
- ALWAYS write your answer in clear English. The sources may be in any language —
  Hindi, Spanish, Japanese, anything. Read them in whatever language they are in and
  translate as you answer. Never reply in the language of the sources.
- Use ONLY the provided sources. Never add outside knowledge, even if you are confident.
- Cite every factual claim inline with its source marker, like [1] or [2][3]. Put the marker right after the claim.
- If the sources do not contain the answer, say so plainly and stop. Do not guess or fill gaps.
- Quote sparingly; explain in your own words.
- Be concise and direct.`;

export function buildMessages(question, chunks, history = []) {
  const sources = chunks
    .map((c, i) => `[${i + 1}] (${c.title})\n${c.text}`)
    .join('\n\n---\n\n');

  return [
    { role: 'system', content: SYSTEM },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    {
      role: 'user',
      content: `Sources:\n\n${sources || '(no sources indexed yet)'}\n\nQuestion: ${question}`,
    },
  ];
}

export async function* streamAnswer(messages) {
  const stream = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages,
    temperature: 0.2,
    stream: true,
  });
  for await (const part of stream) {
    const token = part.choices[0]?.delta?.content;
    if (token) yield token;
  }
}

// Only the markers the model actually used become citations, renumbered so the
// chips read [1][2][3] even if the model cited chunks 2, 5 and 7.
export function extractCitations(answer, chunks) {
  const used = [...new Set([...answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])))]
    .filter((n) => n >= 1 && n <= chunks.length)
    .sort((a, b) => a - b);

  const citations = used.map((n, i) => {
    const chunk = chunks[n - 1];
    return {
      id: String(i + 1),
      sourceId: chunk.sourceId,
      sourceType: chunk.sourceType,
      title: chunk.title,
      snippet: chunk.text.slice(0, 320),
      position: chunk.position,
    };
  });

  const renumbered = answer.replace(/\[(\d+)\]/g, (match, n) => {
    const index = used.indexOf(Number(n));
    return index === -1 ? '' : `[${index + 1}]`;
  });

  return { content: renumbered, citations };
}
