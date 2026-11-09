import mongoose from 'mongoose';
import { env } from '../config/env.js';

export function requireLocalPerformanceDatabase(): string {
  const uri = process.env.TEST_MONGODB_URI;
  if (env.nodeEnv !== 'test' || !uri || uri !== env.mongoUri) {
    throw new Error('Performance scripts require NODE_ENV=test and matching TEST_MONGODB_URI.');
  }

  const parsed = new URL(uri);
  if (
    parsed.protocol !== 'mongodb:' ||
    !['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname) ||
    decodeURIComponent(parsed.pathname.slice(1)) !== 'asoudeh_test' ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error('Performance scripts are restricted to credential-free local asoudeh_test.');
  }
  return uri;
}

export async function connectPerformanceDatabase(): Promise<void> {
  await mongoose.connect(requireLocalPerformanceDatabase(), { autoIndex: false });
}
