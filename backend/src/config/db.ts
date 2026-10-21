import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDB(uri: string = env.mongoUri): Promise<void> {
  await mongoose.connect(uri);
  console.log('MongoDB connected');
}
