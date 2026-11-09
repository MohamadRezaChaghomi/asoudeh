import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import AuditLog from '../src/models/AuditLog.js';
import AuthSession from '../src/models/AuthSession.js';
import Budget from '../src/models/Budget.js';
import CaregiverLink from '../src/models/CaregiverLink.js';
import Category from '../src/models/Category.js';
import Reminder from '../src/models/Reminder.js';
import ReminderCompletion from '../src/models/ReminderCompletion.js';
import Transaction from '../src/models/Transaction.js';
import User from '../src/models/User.js';

interface OrphanReport {
  collection: string;
  relation: string;
  count: number;
  sampleIds: string[];
}

async function findMissingReferences(
  model: mongoose.Model<never>,
  field: string,
  target: mongoose.Model<never>,
  relation: string,
  ignoreNull = false,
): Promise<OrphanReport> {
  const pipeline: mongoose.PipelineStage[] = [
    ...(ignoreNull ? [{ $match: { [field]: { $ne: null } } } as const] : []),
    {
      $lookup: {
        from: target.collection.name,
        localField: field,
        foreignField: '_id',
        as: 'related',
      },
    },
    { $match: { related: { $eq: [] } } },
    {
      $facet: {
        sample: [{ $project: { _id: 1 } }, { $limit: 100 }],
        total: [{ $count: 'count' }],
      },
    },
    {
      $project: {
        _id: 0,
        count: { $ifNull: [{ $arrayElemAt: ['$total.count', 0] }, 0] },
        sampleIds: {
          $map: { input: '$sample', as: 'item', in: { $toString: '$$item._id' } },
        },
      },
    },
  ];
  const [result] = await model.collection.aggregate(pipeline).toArray();
  return {
    collection: model.collection.name,
    relation,
    count: result?.count ?? 0,
    sampleIds: result?.sampleIds ?? [],
  };
}

async function findCompletionOwnerMismatches(): Promise<OrphanReport> {
  const rows = await ReminderCompletion.collection
    .aggregate([
      {
        $lookup: {
          from: Reminder.collection.name,
          localField: 'reminderId',
          foreignField: '_id',
          as: 'reminder',
        },
      },
      {
        $match: {
          $expr: {
            $and: [
              { $gt: [{ $size: '$reminder' }, 0] },
              { $ne: ['$userId', { $arrayElemAt: ['$reminder.userId', 0] }] },
            ],
          },
        },
      },
      {
        $facet: {
          sample: [{ $project: { _id: 1 } }, { $limit: 100 }],
          total: [{ $count: 'count' }],
        },
      },
      {
        $project: {
          _id: 0,
          count: { $ifNull: [{ $arrayElemAt: ['$total.count', 0] }, 0] },
          sampleIds: {
            $map: { input: '$sample', as: 'item', in: { $toString: '$$item._id' } },
          },
        },
      },
    ])
    .toArray();
  const [result] = rows;
  return {
    collection: ReminderCompletion.collection.name,
    relation: 'userId does not match the referenced reminder owner',
    count: result?.count ?? 0,
    sampleIds: result?.sampleIds ?? [],
  };
}

export async function runOrphanReport(uri = env.mongoUri): Promise<OrphanReport[]> {
  await mongoose.connect(uri, { autoIndex: false });
  try {
    return await Promise.all([
      findMissingReferences(Transaction, 'userId', User, 'missing transaction owner'),
      findMissingReferences(Transaction, 'categoryId', Category, 'missing transaction category'),
      findMissingReferences(Budget, 'userId', User, 'missing budget owner'),
      findMissingReferences(Budget, 'categoryId', Category, 'missing budget category'),
      findMissingReferences(Reminder, 'userId', User, 'missing reminder owner'),
      findMissingReferences(
        ReminderCompletion,
        'userId',
        User,
        'missing reminder completion owner',
      ),
      findMissingReferences(
        ReminderCompletion,
        'reminderId',
        Reminder,
        'missing completed reminder',
      ),
      findCompletionOwnerMismatches(),
      findMissingReferences(CaregiverLink, 'seniorId', User, 'missing senior user'),
      findMissingReferences(
        CaregiverLink,
        'caregiverId',
        User,
        'missing caregiver user',
        true,
      ),
      findMissingReferences(AuditLog, 'actorId', User, 'missing audit actor'),
      findMissingReferences(AuditLog, 'targetUserId', User, 'missing audit target'),
      findMissingReferences(AuthSession, 'userId', User, 'missing session owner'),
      findMissingReferences(
        Category,
        'userId',
        User,
        'missing category owner',
        true,
      ),
    ]);
  } finally {
    await mongoose.disconnect();
  }
}

async function main(): Promise<void> {
  const report = await runOrphanReport();
  for (const item of report) {
    console.log(JSON.stringify(item));
  }
  if (report.some(({ count }) => count > 0)) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void main().catch((error: unknown) => {
    console.error('Orphan report failed.', error);
    process.exitCode = 1;
  });
}
