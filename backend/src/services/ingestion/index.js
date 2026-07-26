import Source from '../../models/Source.js';
import { chunkUnits } from './chunker.js';
import { embedTexts } from './embedder.js';
import { upsertChunks, deleteBySource, countBySource } from './qdrantStore.js';
import * as pdf from './adapters/pdf.js';
import * as text from './adapters/text.js';
import * as vtt from './adapters/vtt.js';
import * as website from './adapters/website.js';
import * as youtube from './adapters/youtube.js';
import * as playlist from './adapters/playlist.js';

// One adapter per source type, all behind the same extract() contract:
//   extract(source) -> { units: [{ text, position, break? }], metadata, title?, storageUrl? }
const adapters = { pdf, text, vtt, website, youtube, playlist };

export async function runIngestion({ sourceId }) {
  const source = await Source.findById(sourceId);
  if (!source) return; // deleted while queued — nothing to do

  const setProgress = (progress) => Source.updateOne({ _id: source._id }, { progress }).exec();

  try {
    const adapter = adapters[source.type];
    if (!adapter) throw new Error(`No adapter for source type "${source.type}"`);

    await Source.updateOne({ _id: source._id }, { status: 'processing', progress: 5, error: null });

    const { units, metadata, title, storageUrl } = await adapter.extract(source);
    await setProgress(30);

    let chunks = chunkUnits(units);
    if (!chunks.length) throw new Error('Source produced no indexable text');

    // A website citation highlights by searching the snapshot for the cited text,
    // which only exists once chunking is done.
    if (source.type === 'website') {
      for (const chunk of chunks) {
        chunk.position = { ...chunk.position, anchorText: chunk.text.slice(0, 200) };
      }
    }
    await setProgress(40);

    // Transcripts are embedded in whatever language they were spoken in. The
    // embeddings are multilingual enough to match an English question, and the
    // answer prompt does the translating — once per answer, not once per chunk.
    const vectors = await embedTexts(
      chunks.map((c) => c.text),
      (ratio) => setProgress(40 + Math.round(ratio * 50))
    );

    // Re-index safety: drop any prior points for this source before writing new ones.
    await deleteBySource(source._id);
    await upsertChunks({
      notebookId: source.notebookId,
      sourceId: source._id,
      sourceType: source.type,
      title: title || source.title,
      chunks,
      vectors,
    });

    // If the upsert silently wrote nothing, the source would sit there looking
    // "indexed" and answer every question with "not in the sources".
    const stored = await countBySource(source._id);
    console.log(
      `[ingestion] ${source.type} ${source._id}: ${chunks.length} chunks → ${stored} points`
    );
    if (stored !== chunks.length) {
      throw new Error(`Indexing wrote ${stored} vectors for ${chunks.length} chunks`);
    }

    await Source.updateOne(
      { _id: source._id },
      {
        status: 'indexed',
        progress: 100,
        chunkCount: chunks.length,
        metadata: { ...source.metadata, ...metadata },
        error: null,
        // Adapters that only learn the real title or storage location while
        // extracting (website, youtube, playlist) report it back here.
        ...(title && { title }),
        ...(storageUrl && { storageUrl }),
      }
    );
  } catch (err) {
    await Source.updateOne(
      { _id: source._id },
      { status: 'failed', progress: 0, error: err.message }
    );
    throw err;
  }
}
