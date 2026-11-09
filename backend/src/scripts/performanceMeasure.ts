import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import AuthSession from '../models/AuthSession.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { env } from '../config/env.js';
import {
  formatJalaliMonthKey,
  getCurrentJalaliMonthRange,
} from '../utils/jalaliMonth.js';
import { connectPerformanceDatabase } from './performanceSafety.js';

const PERF_EMAIL = 'performance-seed@asoudeh.invalid';
const ITERATIONS = 12;
const WARMUP_ITERATIONS = 2;
const API_BASE = process.env.PERF_API_URL ?? 'http://127.0.0.1:5000/api/v1';

interface ExplainStats {
  executionStats?: {
    executionTimeMillis?: number;
    nReturned?: number;
    totalDocsExamined?: number;
    totalKeysExamined?: number;
  };
  queryPlanner?: { winningPlan?: unknown };
}

function assertLocalApi(): URL {
  const url = new URL(API_BASE);
  if (
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password
  ) {
    throw new Error('Performance measurement is restricted to a local API URL.');
  }
  return url;
}

function collectStages(value: unknown, stages: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectStages(item, stages);
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, nested] of Object.entries(value)) {
      if ((key === 'stage' || key === 'nodeType') && typeof nested === 'string') {
        stages.push(nested);
      }
      if (key === 'indexName' && typeof nested === 'string') {
        stages.push(`IXSCAN:${nested}`);
      }
      collectStages(nested, stages);
    }
  }
  return [...new Set(stages)];
}

async function explain(name: string, operation: Promise<ExplainStats>) {
  const result = await operation;
  const stats = result.executionStats ?? {};
  return {
    name,
    executionTimeMillis: stats.executionTimeMillis ?? null,
    nReturned: stats.nReturned ?? null,
    totalDocsExamined: stats.totalDocsExamined ?? null,
    totalKeysExamined: stats.totalKeysExamined ?? null,
    stages: collectStages(result.queryPlanner?.winningPlan),
  };
}

async function explainCount(filter: Record<string, unknown>): Promise<ExplainStats> {
  const database = mongoose.connection.db;
  if (!database) throw new Error('The performance database is not connected.');
  return database.command({
    explain: {
      count: Transaction.collection.collectionName,
      query: filter,
    },
    verbosity: 'executionStats',
  }) as Promise<ExplainStats>;
}

function percentile(samples: number[], fraction: number): number {
  const ordered = [...samples].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * fraction) - 1)];
}

async function measureEndpoint(name: string, url: string, cookie: string) {
  const samples: number[] = [];
  for (let index = 0; index < ITERATIONS + WARMUP_ITERATIONS; index += 1) {
    const start = performance.now();
    const response = await fetch(url, { headers: { Cookie: cookie } });
    const durationMs = performance.now() - start;
    if (!response.ok) {
      await response.text();
      throw new Error(`${name} returned HTTP ${response.status}.`);
    }
    await response.body?.cancel();
    if (index >= WARMUP_ITERATIONS) samples.push(durationMs);
  }
  return {
    name,
    samples: samples.length,
    medianMs: Number(percentile(samples, 0.5).toFixed(1)),
    p95Ms: Number(percentile(samples, 0.95).toFixed(1)),
    exceeds200ms: percentile(samples, 0.95) > 200,
  };
}

async function measure(): Promise<void> {
  assertLocalApi();
  await connectPerformanceDatabase();
  let sessionId: mongoose.Types.ObjectId | undefined;
  try {
    const user = await User.findOne({ email: PERF_EMAIL }).select('_id').lean();
    if (!user) throw new Error('Run the performance seed script before measuring.');

    const session = await AuthSession.create({
      userId: user._id,
      familyId: randomUUID(),
      tokenHash: randomUUID(),
      expiresAt: new Date(Date.now() + 30 * 60_000),
      idleExpiresAt: new Date(Date.now() + 30 * 60_000),
    });
    sessionId = session._id;
    const accessToken = jwt.sign(
      { purpose: 'access', sub: user._id.toString(), sid: session._id.toString() },
      env.jwtSecret,
      { algorithm: 'HS256', expiresIn: '20m' },
    );
    const cookie = `asoudeh_access=${encodeURIComponent(accessToken)}`;
    const monthRange = getCurrentJalaliMonthRange();
    const monthKey = formatJalaliMonthKey(monthRange.year, monthRange.month);
    const ownerId = user._id;
    const liveTransactions = { userId: ownerId, deletedAt: null };
    const monthlyTransactions = {
      ...liveTransactions,
      date: { $gte: monthRange.startDate, $lt: monthRange.endDateExclusive },
    };
    const expenseTransactions = {
      ...monthlyTransactions,
      type: 'expense',
    };
    const currentMonthUrl =
      `${API_BASE}/reports/monthly?month=${encodeURIComponent(monthKey)}`;
    const listUrl = `${API_BASE}/transactions?page=1&pageSize=100`;

    const endpointTimings = await Promise.all([
      measureEndpoint('dashboard', `${API_BASE}/dashboard`, cookie),
      measureEndpoint('reports', currentMonthUrl, cookie),
      measureEndpoint('transactions-list', listUrl, cookie),
    ]);
    const explainStats = await Promise.all([
      explain(
        'dashboard-monthly-aggregate',
        Transaction.aggregate([
          { $match: monthlyTransactions },
          { $group: { _id: '$type', amount: { $sum: '$amount' } } },
        ]).explain('executionStats') as Promise<ExplainStats>,
      ),
      explain(
        'reports-expense-aggregate',
        Transaction.aggregate([
          { $match: expenseTransactions },
          { $group: { _id: '$categoryId', amount: { $sum: '$amount' } } },
        ]).explain('executionStats') as Promise<ExplainStats>,
      ),
      explain(
        'transactions-list-page',
        Transaction.find(liveTransactions)
          .sort({ date: -1, _id: -1 })
          .limit(100)
          .explain('executionStats') as Promise<ExplainStats>,
      ),
      explain(
        'transactions-list-count',
        explainCount(liveTransactions),
      ),
    ]);

    console.log(JSON.stringify({
      database: 'asoudeh_test',
      transactions: await Transaction.countDocuments({ userId: ownerId }),
      monthKey,
      endpointTimings,
      explainStats,
    }, null, 2));
  } finally {
    if (sessionId) await AuthSession.deleteOne({ _id: sessionId });
    await mongoose.disconnect();
  }
}

measure().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Performance measurement failed.');
  process.exitCode = 1;
});
