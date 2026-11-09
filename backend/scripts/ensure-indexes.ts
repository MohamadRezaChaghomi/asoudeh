import { pathToFileURL } from 'node:url';
import mongoose, { type Model } from 'mongoose';
import { resolve } from 'node:path';
import { env } from '../src/config/env.js';
import AssistantRateLimit from '../src/models/AssistantRateLimit.js';
import AuditLog from '../src/models/AuditLog.js';
import AuthSession from '../src/models/AuthSession.js';
import Budget from '../src/models/Budget.js';
import CaregiverLink from '../src/models/CaregiverLink.js';
import Category from '../src/models/Category.js';
import OtpChallenge from '../src/models/OtpChallenge.js';
import OtpRateLimit from '../src/models/OtpRateLimit.js';
import Reminder from '../src/models/Reminder.js';
import ReminderCompletion from '../src/models/ReminderCompletion.js';
import Transaction from '../src/models/Transaction.js';
import User from '../src/models/User.js';
import { ensureIndexes, type DuplicateIndex, type IndexModel } from '../src/utils/indexIntegrity.js';

const models: Model<never>[] = [
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

function isLocalTestDatabase(uri: string): boolean {
  try {
    const parsed = new URL(uri);
    return (
      ['127.0.0.1', 'localhost'].includes(parsed.hostname) &&
      decodeURIComponent(parsed.pathname.slice(1)) === 'asoudeh_test' &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}

function indexName(keys: Record<string, unknown>, configuredName: unknown): string {
  if (typeof configuredName === 'string') return configuredName;
  return Object.entries(keys)
    .map(([field, direction]) => `${field}_${String(direction)}`)
    .join('_');
}

function prepareModel(model: Model<never>): IndexModel {
  const uniqueIndexes: DuplicateIndex[] = model.schema
    .indexes()
    .filter(([, options]) => options.unique === true)
    .map(([keys, options]) => {
      const fields = Object.keys(keys);
      const matchClauses: Record<string, unknown>[] = [];
      if (options.partialFilterExpression) {
        matchClauses.push(options.partialFilterExpression as Record<string, unknown>);
      }
      if (options.sparse) {
        matchClauses.push({
          $or: fields.map((field) => ({ [field]: { $exists: true } })),
        });
      }
      const match = matchClauses.length
        ? { $match: { $and: matchClauses } }
        : { $match: {} };
      const groupKey = Object.fromEntries(fields.map((field) => [field, `$${field}`]));
      return {
        modelName: model.modelName,
        indexName: indexName(keys, options.name),
        findDuplicates: async () => {
          const entries = await model.collection
            .aggregate([
              match,
              {
                $group: {
                  _id: groupKey,
                  count: { $sum: 1 },
                  firstId: { $first: '$_id' },
                  lastId: { $last: '$_id' },
                },
              },
              { $match: { count: { $gt: 1 } } },
              {
                $project: {
                  _id: 0,
                  key: '$_id',
                  count: 1,
                  sampleIds: ['$firstId', '$lastId'],
                },
              },
              { $limit: 10 },
            ])
            .toArray();
          return entries.map((entry) => {
            const key =
              typeof entry.key === 'object' && entry.key !== null
                ? Object.fromEntries(
                    Object.entries(entry.key).map(([field, value]) => [
                      field,
                      /phone|email|token|hash/i.test(field) ? '[REDACTED]' : value,
                    ]),
                  )
                : entry.key;
            return {
              key,
              count: entry.count,
              sampleIds: entry.sampleIds as unknown[],
            };
          });
        },
      };
    });

  return {
    modelName: model.modelName,
    uniqueIndexes,
    createIndexes: () => model.createIndexes(),
  };
}

export async function runEnsureIndexes(uri = env.mongoUri): Promise<boolean> {
  await mongoose.connect(uri, { autoIndex: false });
  try {
    return await ensureIndexes(models.map(prepareModel));
  } finally {
    await mongoose.disconnect();
  }
}

async function main(): Promise<void> {
  const uri = env.mongoUri;
  if (!isLocalTestDatabase(uri) && !process.argv.includes('--confirm-non-test-db')) {
    throw new Error(
      'Refusing to create indexes outside local asoudeh_test without --confirm-non-test-db.',
    );
  }
  const created = await runEnsureIndexes(uri);
  if (!created) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void main().catch((error: unknown) => {
    console.error('Index maintenance failed.', error);
    process.exitCode = 1;
  });
}
