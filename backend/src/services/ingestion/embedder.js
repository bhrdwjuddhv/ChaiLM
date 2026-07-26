import { openai } from '../../config/openai.js';
import { EMBEDDING_MODEL } from '../../config/constants.js';

const BATCH = 96;

export async function embedTexts(texts, onProgress) {
  const vectors = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const { data } = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: batch });
    vectors.push(...data.map((d) => d.embedding));
    await onProgress?.(vectors.length / texts.length);
  }
  return vectors;
}

export async function embedQuery(text) {
  const { data } = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: text });
  return data[0].embedding;
}
