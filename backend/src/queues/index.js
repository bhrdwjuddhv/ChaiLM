import { Queue } from 'bullmq';
import { redis } from '../config/redis.js';

export const INGESTION_QUEUE = 'ingestion';
export const PODCAST_QUEUE = 'podcast';

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: 100,
  removeOnFail: 500,
};

export const ingestionQueue = new Queue(INGESTION_QUEUE, { connection: redis, defaultJobOptions });

// Podcast jobs are polled by id, so completed jobs must outlive the request that
// started them — and one retry, not three, since each attempt costs real TTS money.
export const podcastQueue = new Queue(PODCAST_QUEUE, {
  connection: redis,
  defaultJobOptions: { ...defaultJobOptions, attempts: 1, removeOnComplete: { age: 86400 } },
});

export const enqueuePodcast = (notebookId, voice) =>
  podcastQueue.add('generate', { notebookId: String(notebookId), voice });

// No fixed jobId: re-index must be able to enqueue the same source again.
export const enqueueIngestion = (sourceId) =>
  ingestionQueue.add('ingest', { sourceId: String(sourceId) });
