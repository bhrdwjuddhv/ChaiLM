import app from './app.js';
import { PORT, QDRANT_URL, QDRANT_API_KEY, assertEnv } from './config/constants.js';
import { connectDb } from './config/db.js';
import { ensureCollection } from './config/qdrant.js';
import { redis, redactedRedisUrl } from './config/redis.js';
import { startIngestionWorker } from './queues/ingestionWorker.js';
import { startPodcastWorker } from './queues/podcastWorker.js';

assertEnv();

// REDIS_URL and QDRANT_URL both fall back to localhost when unset, which is right
// for dev and dangerous in a deploy — print what was actually chosen so a missing
// variable shows up as "localhost" in the logs instead of as a silent timeout.
console.log(`redis   → ${redactedRedisUrl}`);
console.log(`qdrant  → ${QDRANT_URL}${QDRANT_API_KEY ? ' (api key set)' : ''}`);

// Qdrant Cloud always requires a key; without one every call 401s with nothing
// explaining why.
if (/^https:/i.test(QDRANT_URL) && !QDRANT_API_KEY) {
  throw new Error('QDRANT_URL is an https endpoint but QDRANT_API_KEY is empty — hosted Qdrant will reject every request');
}

await connectDb();
await ensureCollection();
startIngestionWorker();
startPodcastWorker();

app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));

// Without this a container gets SIGTERM'd mid-job and the in-flight ingestion
// is left claimed in Redis until its lock expires.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    await redis.quit().catch(() => {});
    process.exit(0);
  });
}
