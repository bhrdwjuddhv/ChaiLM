import app from './app.js';
import { PORT, QDRANT_URL, QDRANT_API_KEY, assertEnv } from './config/constants.js';
import { connectDb } from './config/db.js';
import { ensureCollection } from './config/qdrant.js';
import { redis } from './config/redis.js';
import { startIngestionWorker } from './queues/ingestionWorker.js';
import { startPodcastWorker } from './queues/podcastWorker.js';

assertEnv();

// Qdrant Cloud always requires a key; without one every call 401s with nothing
// explaining why.
if (/^https:/i.test(QDRANT_URL) && !QDRANT_API_KEY) {
  throw new Error('QDRANT_URL is an https endpoint but QDRANT_API_KEY is empty — hosted Qdrant will reject every request');
}

try {
  await connectDb();
} catch (err) {
  // Mongoose dumps the whole topology (hundreds of lines, one block per shard)
  // and buries the one line that matters. Atlas answers a non-allowlisted IP or
  // a paused cluster with a TLS alert before it ever presents a certificate.
  // The per-shard causes live in a Map of ServerDescriptions and are Error
  // objects, so they vanish under JSON.stringify — read them directly.
  const shardErrors = [...(err.reason?.servers?.values?.() ?? [])]
    .map((s) => s.error?.message ?? '')
    .join(' ');
  const tlsRejected = /tlsv1 alert internal error|ERR_SSL_TLSV1_ALERT/i.test(
    `${err.message} ${shardErrors}`
  );
  console.error(`\nMongoDB connection failed: ${err.message.split('\n')[0]}`);
  if (tlsRejected) {
    console.error(
      'Atlas closed the TLS handshake before sending a certificate. That is not a\n' +
        'credential or driver problem — it means the cluster is refusing this host:\n' +
        '  1. Add your current public IP to Atlas → Network Access → IP Access List\n' +
        '  2. Check the cluster is not paused (Atlas pauses idle free clusters)\n'
    );
  }
  process.exit(1);
}
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
