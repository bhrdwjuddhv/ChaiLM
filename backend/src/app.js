import express from 'express';
import cors from 'cors';
import { CLIENT_URL } from './config/constants.js';
import { dbReady } from './config/db.js';
import { qdrant } from './config/qdrant.js';
import { redis } from './config/redis.js';
import { notFound, errorHandler } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import notebookRoutes from './routes/notebooks.js';
import sourceRoutes from './routes/sources.js';

const app = express();

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', async (req, res) => {
  const [qdrantOk, redisOk] = await Promise.all([
    qdrant.getCollections().then(() => true, () => false),
    redis.ping().then((r) => r === 'PONG', () => false),
  ]);
  const ok = dbReady() && qdrantOk && redisOk;
  res.status(ok ? 200 : 503).json({ ok, mongo: dbReady(), qdrant: qdrantOk, redis: redisOk });
});

app.use('/api/auth', authRoutes);
app.use('/api/notebooks', notebookRoutes);
app.use('/api/sources', sourceRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
