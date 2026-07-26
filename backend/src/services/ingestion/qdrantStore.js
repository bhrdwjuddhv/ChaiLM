import { randomUUID } from 'node:crypto';
import { qdrant } from '../../config/qdrant.js';
import { QDRANT_COLLECTION } from '../../config/constants.js';

const byNotebook = (notebookId) => ({
  must: [{ key: 'notebookId', match: { value: String(notebookId) } }],
});

// notebookId is stringified on write AND on every filter — a Mongo ObjectId and
// its string form are different values to Qdrant, and a mismatch matches nothing.
export function upsertChunks({ notebookId, sourceId, sourceType, title, chunks, vectors }) {
  return qdrant.upsert(QDRANT_COLLECTION, {
    wait: true,
    points: chunks.map((chunk, i) => ({
      id: randomUUID(),
      vector: vectors[i],
      payload: {
        notebookId: String(notebookId),
        sourceId: String(sourceId),
        sourceType,
        chunkIndex: chunk.chunkIndex,
        // Stored in the source's own language — the answer prompt translates.
        text: chunk.text,
        title,
        position: chunk.position ?? null,
      },
    })),
  });
}

export async function countBySource(sourceId) {
  const { count } = await qdrant.count(QDRANT_COLLECTION, {
    filter: { must: [{ key: 'sourceId', match: { value: String(sourceId) } }] },
    exact: true,
  });
  return count;
}

export const deleteBySource = (sourceId) =>
  qdrant.delete(QDRANT_COLLECTION, {
    wait: true,
    filter: { must: [{ key: 'sourceId', match: { value: String(sourceId) } }] },
  });

export const deleteByNotebook = (notebookId) =>
  qdrant.delete(QDRANT_COLLECTION, { wait: true, filter: byNotebook(notebookId) });

// Qdrant is the only place a video/caption transcript is stored, so the viewer
// reads it back from here. Scroll returns no guaranteed order — sort explicitly.
export async function getSourceChunks(sourceId) {
  const { points } = await qdrant.scroll(QDRANT_COLLECTION, {
    filter: { must: [{ key: 'sourceId', match: { value: String(sourceId) } }] },
    limit: 2000,
    with_payload: true,
    with_vector: false,
  });
  return points
    .map((p) => ({ chunkIndex: p.payload.chunkIndex, text: p.payload.text, position: p.payload.position }))
    .sort((a, b) => a.chunkIndex - b.chunkIndex);
}

// Whole-notebook read for the roadmap and podcast jobs, which summarise rather
// than answer and so have no query vector to search with.
export async function getNotebookChunks(notebookId, { types, limit = 400 } = {}) {
  const must = [{ key: 'notebookId', match: { value: String(notebookId) } }];
  if (types?.length) must.push({ key: 'sourceType', match: { any: types } });

  const { points } = await qdrant.scroll(QDRANT_COLLECTION, {
    filter: { must },
    limit,
    with_payload: true,
    with_vector: false,
  });

  return points
    .map((p) => p.payload)
    .sort((a, b) =>
      a.sourceId === b.sourceId ? a.chunkIndex - b.chunkIndex : a.sourceId.localeCompare(b.sourceId)
    );
}

// The notebookId filter is the isolation guarantee. There is no unfiltered search path.
export async function searchChunks({ notebookId, vector, limit = 8 }) {
  const results = await qdrant.search(QDRANT_COLLECTION, {
    vector,
    filter: byNotebook(notebookId),
    limit,
    with_payload: true,
  });
  return results.map((r) => ({ score: r.score, ...r.payload }));
}
