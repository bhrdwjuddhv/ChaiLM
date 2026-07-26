import IORedis from 'ioredis';
import { REDIS_URL } from './constants.js';

// One connection shared by every Queue and Worker. Whether this is a local
// container or Upstash is decided entirely by REDIS_URL — the rediss:// scheme
// switches ioredis to TLS on its own, so hosted Redis needs no extra config.
// (Upstash's REST URL + token will NOT work here: BullMQ speaks the Redis wire
// protocol, so it needs the ioredis/TCP endpoint.)
export const redis = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null, // required by BullMQ
});
