import mongoose from 'mongoose';
import { MONGODB_URI } from './constants.js';

export function connectDb() {
  return mongoose.connect(MONGODB_URI);
}

export const dbReady = () => mongoose.connection.readyState === 1;
