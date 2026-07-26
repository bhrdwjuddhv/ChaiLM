import path from 'node:path';
import Notebook from '../models/Notebook.js';
import Source from '../models/Source.js';
import { uploadBuffer } from '../config/cloudinary.js';
import { destroySourceAssets } from '../utils/cleanup.js';
import { deleteBySource, getSourceChunks } from '../services/ingestion/qdrantStore.js';
import { enqueueIngestion } from '../queues/index.js';
import { typeForFile } from '../middleware/upload.js';
import { parseVideoId, parsePlaylistId, findYoutubeLink } from '../utils/youtube.js';

// Reused by every source route: proves the notebook is this user's before touching it.
async function ownedNotebook(req) {
  const notebook = await Notebook.findOne({ _id: req.params.id, userId: req.userId });
  if (!notebook) throw Object.assign(new Error('Notebook not found'), { status: 404 });
  return notebook;
}

async function ownedSource(req) {
  const source = await Source.findOne({ _id: req.params.sourceId, userId: req.userId });
  if (!source) throw Object.assign(new Error('Source not found'), { status: 404 });
  return source;
}

export async function list(req, res) {
  const notebook = await ownedNotebook(req);
  res.json(await Source.find({ notebookId: notebook._id }).sort({ createdAt: 1 }));
}

export async function getOne(req, res) {
  res.json(await ownedSource(req));
}

// Backs the transcript panel in the viewer.
export async function chunks(req, res) {
  const source = await ownedSource(req);
  res.json(await getSourceChunks(source._id));
}

export async function uploadSource(req, res) {
  const notebook = await ownedNotebook(req);
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const type = typeForFile(req.file.originalname);
  const title = path.basename(req.file.originalname, path.extname(req.file.originalname));

  const source = await Source.create({
    notebookId: notebook._id,
    userId: req.userId,
    type,
    title,
    status: 'pending',
    metadata: { originalName: req.file.originalname, bytes: req.file.size },
  });

  try {
    const uploaded = await uploadBuffer(req.file.buffer, {
      folder: `chaillm/${notebook._id}`,
      publicId: String(source._id),
      format: path.extname(req.file.originalname).slice(1),
    });
    source.storageUrl = uploaded.secure_url;
    source.metadata = { ...source.metadata, publicId: uploaded.public_id };
    await source.save();
  } catch (err) {
    await Source.updateOne({ _id: source._id }, { status: 'failed', error: `Upload failed: ${err.message}` });
    throw err;
  }

  await enqueueIngestion(source._id);
  res.status(201).json(source);
}

// Detection order matters: a watch URL carrying &list= is a playlist, not a video.
export function detectPasted(content) {
  const trimmed = content.trim();
  const isUrl = /^https?:\/\/\S+$/i.test(trimmed);

  if (isUrl) {
    const playlistId = parsePlaylistId(trimmed);
    if (playlistId) {
      return { type: 'playlist', title: `Playlist ${playlistId}`, metadata: { playlistId } };
    }
    const videoId = parseVideoId(trimmed);
    if (videoId) {
      return { type: 'youtube', title: `Video ${videoId}`, metadata: { videoId } };
    }
    return { type: 'website', title: new URL(trimmed).hostname, metadata: {} };
  }

  // Plain text. A YouTube link buried inside it is kept so the viewer can embed it.
  const embedded = findYoutubeLink(trimmed);
  return {
    type: 'text',
    title: trimmed.split('\n')[0].slice(0, 60) || 'Pasted text',
    metadata: {
      content: trimmed,
      ...(embedded && { embeddedVideoId: parseVideoId(embedded), embeddedUrl: embedded }),
    },
  };
}

export async function pasteSource(req, res) {
  const notebook = await ownedNotebook(req);
  const content = req.body?.content;
  if (!content?.trim()) return res.status(400).json({ error: 'content is required' });

  const { type, title, metadata } = detectPasted(content);
  const isUrl = type !== 'text';

  const source = await Source.create({
    notebookId: notebook._id,
    userId: req.userId,
    type,
    title,
    status: 'pending',
    sourceUrl: isUrl ? content.trim() : undefined,
    metadata,
  });

  await enqueueIngestion(source._id);
  res.status(201).json(source);
}

export async function reindex(req, res) {
  const source = await ownedSource(req);
  await deleteBySource(source._id);
  await Source.updateOne(
    { _id: source._id },
    { status: 'pending', progress: 0, chunkCount: 0, error: null }
  );
  await enqueueIngestion(source._id);
  res.json(await Source.findById(source._id));
}

export async function remove(req, res) {
  const source = await ownedSource(req);
  await deleteBySource(source._id);
  await destroySourceAssets(source);
  await source.deleteOne();
  res.status(204).end();
}
