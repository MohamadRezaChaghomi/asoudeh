import mongoose from 'mongoose';
import { afterEach, describe, expect, it } from 'vitest';
import { connectDB } from '../config/db.js';

const testMongoUri = process.env.TEST_MONGODB_URI;

function isLocalTestDatabase(uri: string | undefined): uri is string {
  if (!uri) {
    return false;
  }

  try {
    const parsedUri = new URL(uri);
    const databaseName = decodeURIComponent(parsedUri.pathname.slice(1));

    return (
      ['127.0.0.1', 'localhost'].includes(parsedUri.hostname) &&
      databaseName === 'asoudeh_test' &&
      !parsedUri.username &&
      !parsedUri.password
    );
  } catch {
    return false;
  }
}

afterEach(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

describe('MongoDB connection', () => {
  it.skipIf(!testMongoUri)('connects to the isolated local test database', async () => {
    if (!isLocalTestDatabase(testMongoUri)) {
      throw new Error(
        'TEST_MONGODB_URI must target local database asoudeh_test without credentials.',
      );
    }

    await connectDB(testMongoUri);
    const result = await mongoose.connection.db?.admin().ping();

    expect(mongoose.connection.name).toBe('asoudeh_test');
    expect(result?.ok).toBe(1);
  });
});
