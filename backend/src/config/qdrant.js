import { QdrantClient } from '@qdrant/js-client-rest';
import {
  QDRANT_URL,
  QDRANT_API_KEY,
  QDRANT_COLLECTION,
  EMBEDDING_DIM,
} from './constants.js';

// Local container or Qdrant Cloud is decided entirely by QDRANT_URL. The key is
// omitted rather than sent empty, since a local instance rejects an empty header.
export const qdrant = new QdrantClient({
  url: QDRANT_URL,
  apiKey: QDRANT_API_KEY || undefined,
});

// Idempotent: safe to call on every boot.
export async function ensureCollection() {
  const { collections } = await qdrant.getCollections();
  if (collections.some((c) => c.name === QDRANT_COLLECTION)) return;

  await qdrant.createCollection(QDRANT_COLLECTION, {
    vectors: { size: EMBEDDING_DIM, distance: 'Cosine' },
  });
  // Payload indexes: without these, filtered search falls back to a full scan.
  await qdrant.createPayloadIndex(QDRANT_COLLECTION, {
    field_name: 'notebookId',
    field_schema: 'keyword',
  });
  await qdrant.createPayloadIndex(QDRANT_COLLECTION, {
    field_name: 'sourceId',
    field_schema: 'keyword',
  });
}
