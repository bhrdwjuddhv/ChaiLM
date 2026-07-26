import OpenAI from 'openai';
import { OPENAI_API_KEY } from './constants.js';

// assertEnv() at boot is the real guard. The placeholder only stops the SDK from
// throwing at import time in contexts that never call OpenAI (tests, one-off scripts).
export const openai = new OpenAI({ apiKey: OPENAI_API_KEY || 'missing-api-key' });
