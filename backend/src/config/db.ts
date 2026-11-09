import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export async function connectDB(uri: string = env.mongoUri): Promise<void> {
  await mongoose.connect(uri, { autoIndex: env.nodeEnv !== 'production' });
  logger.info('mongodb_connected');
}

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}
