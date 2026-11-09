import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import mongoose from 'mongoose';
import AssistantRateLimit from '../models/AssistantRateLimit.js';
import AuditLog from '../models/AuditLog.js';
import AuthSession from '../models/AuthSession.js';
import Budget from '../models/Budget.js';
import CaregiverLink from '../models/CaregiverLink.js';
import Category from '../models/Category.js';
import OtpChallenge from '../models/OtpChallenge.js';
import OtpRateLimit from '../models/OtpRateLimit.js';
import Reminder from '../models/Reminder.js';
import ReminderCompletion from '../models/ReminderCompletion.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { requireLocalRestoreCheckUri } from '../utils/restoreCheckSafety.js';

const models = [
  AssistantRateLimit,
  AuditLog,
  AuthSession,
  Budget,
  CaregiverLink,
  Category,
  OtpChallenge,
  OtpRateLimit,
  Reminder,
  ReminderCompletion,
  Transaction,
  User,
];

function indexName(keys: Record<string, unknown>, configuredName: unknown): string {
  if (typeof configuredName === 'string') return configuredName;
  return Object.entries(keys)
    .map(([field, direction]) => `${field}_${String(direction)}`)
    .join('_');
}

export async function runRestoreIntegrityCheck(
  uri = process.env.RESTORE_CHECK_MONGODB_URI,
): Promise<boolean> {
  const targetUri = requireLocalRestoreCheckUri(uri);
  await mongoose.connect(targetUri, { autoIndex: false });
  let valid = true;
  try {
    for (const model of models) {
      const count = await model.countDocuments({});
      const expected = model.schema.indexes().map(([keys, options]) => ({
        name: indexName(keys, options.name),
        keys,
      }));
      let actual: Array<{ name?: string; key: Record<string, unknown> }> = [];
      try {
        actual = await model.collection.indexes();
      } catch (error) {
        if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 26)) {
          throw error;
        }
      }
      const missing = expected.filter(
        (expectedIndex) =>
          !actual.some(
            (actualIndex) =>
              actualIndex.name === expectedIndex.name &&
              JSON.stringify(actualIndex.key) === JSON.stringify(expectedIndex.keys),
          ),
      );
      if (missing.length) valid = false;
      console.log(
        JSON.stringify({
          collection: model.collection.name,
          documentCount: count,
          expectedIndexes: expected.map(({ name }) => name),
          presentIndexes: actual.map(({ name }) => name),
          missingIndexes: missing.map(({ name }) => name),
        }),
      );
    }
  } finally {
    await mongoose.disconnect();
  }

  return valid;
}

async function main(): Promise<void> {
  if (!(await runRestoreIntegrityCheck())) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void main().catch((error: unknown) => {
    console.error('Restore integrity check failed.', {
      errorType: error instanceof Error ? error.name : 'UnknownError',
    });
    process.exitCode = 1;
  });
}
