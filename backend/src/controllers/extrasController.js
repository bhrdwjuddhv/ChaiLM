import Notebook from '../models/Notebook.js';
import { buildRoadmap } from '../services/roadmap/index.js';
import { podcastQueue, enqueuePodcast } from '../queues/index.js';

async function ownedNotebook(req) {
  const notebook = await Notebook.findOne({ _id: req.params.id, userId: req.userId });
  if (!notebook) throw Object.assign(new Error('Notebook not found'), { status: 404 });
  return notebook;
}

// ponytail: synchronous, unlike the podcast. It is one completion, and §11 gives
// roadmap no status endpoint to poll. If it starts timing out, it needs the same
// queue-plus-jobId treatment the podcast already has.
export async function roadmap(req, res) {
  const notebook = await ownedNotebook(req);
  const result = await buildRoadmap(notebook._id);
  await Notebook.updateOne({ _id: notebook._id }, { roadmap: result });
  res.json(result);
}

export async function startPodcast(req, res) {
  const notebook = await ownedNotebook(req);
  const voice = req.body?.voice === 'male' ? 'male' : 'female';

  const job = await enqueuePodcast(notebook._id, voice);
  res.status(202).json({ jobId: job.id, status: 'queued', voice });
}

export async function podcastStatus(req, res) {
  const notebook = await ownedNotebook(req);

  const job = await podcastQueue.getJob(req.params.jobId);
  if (!job) {
    // Jobs expire; the finished episode lives on the notebook.
    if (notebook.podcast) return res.json({ status: 'completed', ...notebook.podcast });
    return res.status(404).json({ error: 'Job not found' });
  }
  // A job id is guessable, so confirm this job belongs to the notebook in the URL.
  if (String(job.data.notebookId) !== String(notebook._id)) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const state = await job.getState();
  if (state === 'completed') return res.json({ status: 'completed', ...job.returnvalue });
  if (state === 'failed') {
    return res.status(200).json({ status: 'failed', error: job.failedReason || 'Generation failed' });
  }
  res.json({ status: state, progress: job.progress || 0 });
}
