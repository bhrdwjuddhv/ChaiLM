import { Worker } from 'bullmq';
import { redis } from '../config/redis.js';
import { PODCAST_QUEUE } from './index.js';
import { generatePodcast } from '../services/podcast/index.js';
import Notebook from '../models/Notebook.js';

export function startPodcastWorker() {
  const worker = new Worker(
    PODCAST_QUEUE,
    async (job) => {
      const result = await generatePodcast(job.data, (ratio) =>
        job.updateProgress(Math.round(ratio * 100))
      );
      // Kept on the notebook so the latest episode survives the job expiring.
      await Notebook.updateOne({ _id: job.data.notebookId }, { podcast: result });
      return result;
    },
    { connection: redis, concurrency: 1 }
  );

  worker.on('failed', (job, err) =>
    console.error(`[podcast] ${job?.data?.notebookId} failed:`, err.message)
  );
  return worker;
}
