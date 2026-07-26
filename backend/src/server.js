import app from './app.js';
import { PORT, assertEnv } from './config/constants.js';
import { connectDb } from './config/db.js';
import { ensureCollection } from './config/qdrant.js';
import { startIngestionWorker } from './queues/ingestionWorker.js';
import { startPodcastWorker } from './queues/podcastWorker.js';

assertEnv();
await connectDb();
await ensureCollection();
startIngestionWorker();
startPodcastWorker();

app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));
