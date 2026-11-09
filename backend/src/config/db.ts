import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDB(uri: string = env.mongoUri): Promise<void> {
  await mongoose.connect(uri, { autoIndex: env.nodeEnv !== 'production' });
  console.log('MongoDB connected');
}

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}
