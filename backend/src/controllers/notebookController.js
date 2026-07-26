import Notebook from '../models/Notebook.js';
import Source from '../models/Source.js';
import Message from '../models/Message.js';
import { deleteByNotebook } from '../services/ingestion/qdrantStore.js';
import { destroySourceAssets } from '../utils/cleanup.js';

// Every query is scoped by userId — that scoping IS the authorization check.
const owned = (req) => ({ _id: req.params.id, userId: req.userId });

export async function list(req, res) {
  res.json(await Notebook.find({ userId: req.userId }).sort({ updatedAt: -1 }));
}

export async function create(req, res) {
  const { title, description } = req.body || {};
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
  const notebook = await Notebook.create({
    userId: req.userId,
    title: title.trim(),
    description: description?.trim() || '',
  });
  res.status(201).json(notebook);
}

export async function getOne(req, res) {
  const notebook = await Notebook.findOne(owned(req));
  if (!notebook) return res.status(404).json({ error: 'Notebook not found' });
  res.json(notebook);
}

export async function update(req, res) {
  const patch = {};
  if (req.body?.title !== undefined) {
    if (!req.body.title.trim()) return res.status(400).json({ error: 'title cannot be empty' });
    patch.title = req.body.title.trim();
  }
  if (req.body?.description !== undefined) patch.description = req.body.description.trim();

  const notebook = await Notebook.findOneAndUpdate(owned(req), patch, { new: true });
  if (!notebook) return res.status(404).json({ error: 'Notebook not found' });
  res.json(notebook);
}

export async function remove(req, res) {
  const notebook = await Notebook.findOne(owned(req));
  if (!notebook) return res.status(404).json({ error: 'Notebook not found' });

  // Purge the notebook's contents before the notebook itself: if anything below
  // throws, the notebook still exists and the delete can be retried. Dropping the
  // notebook first would strand its sources with no owner to reach them through.
  const sources = await Source.find({ notebookId: notebook._id });
  await deleteByNotebook(notebook._id);
  for (const source of sources) await destroySourceAssets(source);

  await Source.deleteMany({ notebookId: notebook._id });
  await Message.deleteMany({ notebookId: notebook._id });
  await notebook.deleteOne();

  res.status(204).end();
}
