import { Worker } from 'bullmq';
import { redis } from '../config/redis.js';
import { INGESTION_QUEUE } from './index.js';
import { runIngestion } from '../services/ingestion/index.js';

// ponytail: runs in-process with the API. Split into its own entrypoint
// (`node src/queues/ingestionWorker.js`) when embedding load starts starving requests.
export function startIngestionWorker() {
  const worker = new Worker(INGESTION_QUEUE, (job) => runIngestion(job.data), {
    connection: redis,
    concurrency: 2,
  });

  worker.on('failed', (job, err) =>
    console.error(`[ingestion] ${job?.data?.sourceId} failed:`, err.message)
  );
  return worker;
}
