import dotenv from 'dotenv';

// backend/.env — the frontend has its own, so the two deploy independently.
dotenv.config({ quiet: true });

// All env access lives here. Nothing else in the codebase reads process.env.
export const PORT = Number(process.env.PORT) || 5000;
export const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
export const MONGODB_URI = process.env.MONGODB_URI;
export const JWT_SECRET = process.env.JWT_SECRET;
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
export const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
export const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
export const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
export const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
export const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
export const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

// OpenAI model ids — change here, nowhere else.
export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIM = 1536;
export const CHAT_MODEL = 'gpt-4o-mini';
export const TTS_MODEL = 'gpt-4o-mini-tts';

export const QDRANT_COLLECTION = 'chunks';

// Asserted at boot. Append per phase as features start needing keys.
export const REQUIRED_ENV = [
  'MONGODB_URI',
  'JWT_SECRET',
  'OPENAI_API_KEY',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];

export function assertEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}
