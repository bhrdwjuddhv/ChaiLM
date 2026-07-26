import IORedis from 'ioredis';
import { REDIS_URL } from './constants.js';

// BullMQ requires maxRetriesPerRequest: null on its connections.
export const redis = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
