import { randomBytes, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../app.js';
import { env } from '../config/env.js';
import { connectDB } from '../config/db.js';
import AuthSession, { AUTH_SESSION_IDLE_TIMEOUT_MS } from '../models/AuthSession.js';
import Reminder from '../models/Reminder.js';
import ReminderCompletion from '../models/ReminderCompletion.js';
import User from '../models/User.js';
import {
  completeReminder,
  getUpcomingReminders,
  listReminders,
} from '../services/reminders.service.js';
import {
  formatJalaliMonthKey,
  formatUtcDateOnly,
  getCurrentJalaliMonthRange,
  getJalaliMonthRange,
  getMonthlyOccurrenceDate,
} from '../utils/jalaliMonth.js';

const testMongoUri = process.env.TEST_MONGODB_URI;
const configuredMongoUri = process.env.MONGODB_URI;
const csrfToken = 'reminder-api-test-csrf-token';
const userIds: mongoose.Types.ObjectId[] = [];
const sessionIds: mongoose.Types.ObjectId[] = [];
const reminderIds: mongoose.Types.ObjectId[] = [];
const completionIds: mongoose.Types.ObjectId[] = [];

interface TestIdentity {
  userId: string;
  accessToken: string;
}

function isIsolatedTestUri(uri: string | undefined): uri is string {
  if (!uri) return false;
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

async function createIdentity(name: string): Promise<TestIdentity> {
  const user = await User.create({ name });
  userIds.push(user._id);
  const session = await AuthSession.create({
    userId: user._id,
    familyId: randomUUID(),
    tokenHash: randomBytes(32).toString('hex'),
    expiresAt: new Date(Date.now() + 60_000),
    idleExpiresAt: new Date(Date.now() + AUTH_SESSION_IDLE_TIMEOUT_MS),
  });
  sessionIds.push(session._id);
  return {
    userId: user.id,
    accessToken: jwt.sign(
      { purpose: 'access', sid: session.id },
      env.jwtSecret,
      { algorithm: 'HS256', expiresIn: 900, subject: user.id },
    ),
  };
}

function authenticatedGet(path: string, identity: TestIdentity) {
  return request(app)
    .get(path)
    .set('Cookie', `asoudeh_access=${identity.accessToken}`);
}

function authenticatedMutation(
  method: 'post' | 'patch' | 'delete',
  path: string,
  identity: TestIdentity,
  body?: Record<string, unknown>,
) {
  const req = request(app)[method](path)
    .set('Origin', env.clientUrl)
    .set(
      'Cookie',
      `asoudeh_access=${identity.accessToken}; asoudeh_csrf=${csrfToken}`,
    )
    .set('X-CSRF-Token', csrfToken);
  return body ? req.send(body) : req;
}

describe.skipIf(!testMongoUri || !configuredMongoUri)('Reminder API', () => {
  let owner: TestIdentity;
  let otherUser: TestIdentity;

  beforeAll(async () => {
    if (!isIsolatedTestUri(testMongoUri) || !isIsolatedTestUri(configuredMongoUri)) {
      throw new Error(
        'Reminder API tests require both MongoDB URIs to target local database asoudeh_test.',
      );
    }
    await connectDB(testMongoUri);
    await Promise.all([
      AuthSession.init(),
      Reminder.init(),
      ReminderCompletion.init(),
      User.init(),
    ]);
    const indexes = await ReminderCompletion.collection.indexes();
    expect(indexes).toContainEqual(
      expect.objectContaining({
        name: 'reminder_month_completion_unique',
        unique: true,
        key: { reminderId: 1, monthKey: 1 },
      }),
    );
    owner = await createIdentity('Reminder owner');
    otherUser = await createIdentity('Reminder other user');
  }, 20_000);

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      if (completionIds.length) {
        await ReminderCompletion.deleteMany({ _id: { $in: completionIds } });
      }
      if (reminderIds.length) {
        await Reminder.deleteMany({ _id: { $in: reminderIds } });
      }
      if (sessionIds.length) {
        await AuthSession.deleteMany({ _id: { $in: sessionIds } });
      }
      if (userIds.length) {
        await User.deleteMany({ _id: { $in: userIds } });
      }
    }
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }, 20_000);

  async function createApiReminder(
    identity = owner,
    overrides: Record<string, unknown> = {},
  ): Promise<{ id: string; response: request.Response }> {
    const response = await authenticatedMutation(
      'post',
      '/api/v1/reminders',
      identity,
      {
        title: `یادآور ${randomUUID()}`,
        date: '2026-01-15',
        recurrence: 'monthly',
        ...overrides,
      },
    );
    expect(response.status).toBe(201);
    const id = response.body.data.reminder.id as string;
    reminderIds.push(new mongoose.Types.ObjectId(id));
    return { id, response };
  }

  it('creates, lists, and edits only the authenticated owner’s reminders', async () => {
    const { id, response } = await createApiReminder(owner, { amount: 75_000 });
    const ownedList = await authenticatedGet('/api/v1/reminders', owner);
    const foreignList = await authenticatedGet('/api/v1/reminders', otherUser);

    expect(response.body.data.reminder).toMatchObject({
      id,
      amount: 75_000,
      recurrence: 'monthly',
      isActive: true,
      isCompleted: false,
    });
    expect(ownedList.status).toBe(200);
    expect(ownedList.body.data.reminders.map(({ id: reminderId }: { id: string }) => reminderId))
      .toContain(id);
    expect(foreignList.body.data.reminders).toEqual([]);

    const updated = await authenticatedMutation('patch', `/api/v1/reminders/${id}`, owner, {
      title: 'قبض برق',
      amount: null,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data.reminder.title).toBe('قبض برق');
    expect(updated.body.data.reminder).not.toHaveProperty('amount');
    expect(
      await ReminderCompletion.countDocuments({ reminderId: new mongoose.Types.ObjectId(id) }),
    ).toBe(0);
  });

  it('rejects invalid title, date, amount, recurrence, id, and client ownership', async () => {
    const invalidBodies = [
      { title: '  ', date: '2026-01-15', recurrence: 'none' },
      { title: 'Reminder', date: '2026-02-30', recurrence: 'none' },
      { title: 'Reminder', date: '2026-01-15', recurrence: 'yearly' },
      { title: 'Reminder', date: '2026-01-15', recurrence: 'none', amount: 1.5 },
      { title: 'Reminder', date: '2026-01-15', recurrence: 'none', amount: 0 },
      { title: 'Reminder', date: '2026-01-15', recurrence: 'none', userId: otherUser.userId },
    ];
    for (const body of invalidBodies) {
      const response = await authenticatedMutation('post', '/api/v1/reminders', owner, body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
    const invalidId = await authenticatedMutation(
      'post',
      '/api/v1/reminders/not-an-id/complete',
      owner,
      {},
    );
    expect(invalidId.status).toBe(400);
    const clientMonth = await authenticatedMutation(
      'post',
      `/api/v1/reminders/${new mongoose.Types.ObjectId()}/complete`,
      owner,
      { monthKey: '1405-07' },
    );
    expect(clientMonth.status).toBe(400);
  });

  it('requires authentication, Origin, and CSRF for state-changing operations', async () => {
    const unauthenticated = await request(app).get('/api/v1/reminders');
    expect(unauthenticated.status).toBe(401);

    const missingOrigin = await request(app)
      .post('/api/v1/reminders')
      .set('Cookie', `asoudeh_access=${owner.accessToken}; asoudeh_csrf=${csrfToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({ title: 'Test', date: '2026-01-15', recurrence: 'none' });
    expect(missingOrigin.status).toBe(403);

    const missingCsrf = await request(app)
      .post('/api/v1/reminders')
      .set('Origin', env.clientUrl)
      .set('Cookie', `asoudeh_access=${owner.accessToken}`)
      .send({ title: 'Test', date: '2026-01-15', recurrence: 'none' });
    expect(missingCsrf.status).toBe(403);
  });

  it('persists monthly completion idempotently and reactivates in the next Jalali month', async () => {
    const anchorRange = getJalaliMonthRange(1405, 6);
    const anchor = new Date(anchorRange.startDate.getTime() + 30 * 86_400_000);
    const { id } = await createApiReminder(owner, {
      date: formatUtcDateOnly(anchor),
      recurrence: 'monthly',
    });
    const reminderObjectId = new mongoose.Types.ObjectId(id);
    const mehrRange = getJalaliMonthRange(1405, 7);
    const mehrNow = new Date(mehrRange.startDate.getTime() + 10 * 86_400_000);

    const first = await completeReminder(owner.userId, id, mehrNow);
    const repeated = await completeReminder(owner.userId, id, mehrNow);
    completionIds.push(new mongoose.Types.ObjectId(first.id));
    expect(first).toEqual(repeated);
    expect(first.monthKey).toBe('07-1405');
    expect(
      await ReminderCompletion.countDocuments({ reminderId: reminderObjectId }),
    ).toBe(1);
    expect(
      (await listReminders(owner.userId, mehrNow)).reminders.find((item) => item.id === id)
        ?.isCompleted,
    ).toBe(true);
    const editedAfterCompletion = await authenticatedMutation(
      'patch',
      `/api/v1/reminders/${id}`,
      owner,
      { title: 'عنوان ویرایش‌شده پس از تکمیل' },
    );
    expect(editedAfterCompletion.status).toBe(200);
    expect(
      await ReminderCompletion.countDocuments({ reminderId: reminderObjectId }),
    ).toBe(1);

    const abanRange = getJalaliMonthRange(1405, 8);
    const abanNow = new Date(abanRange.startDate.getTime() + 5 * 86_400_000);
    const afterTransition = await listReminders(owner.userId, abanNow);
    expect(afterTransition.monthKey).toBe('08-1405');
    expect(afterTransition.reminders.find((item) => item.id === id)?.isCompleted).toBe(false);

    const second = await completeReminder(owner.userId, id, abanNow);
    completionIds.push(new mongoose.Types.ObjectId(second.id));
    expect(second.monthKey).toBe('08-1405');
    expect(
      await ReminderCompletion.countDocuments({ reminderId: reminderObjectId }),
    ).toBe(2);
    expect(
      await ReminderCompletion.find({ reminderId: reminderObjectId })
        .sort({ monthKey: 1 })
        .distinct('monthKey'),
    ).toEqual(['07-1405', '08-1405']);
  });

  it('handles concurrent completion requests with one history row per reminder and month', async () => {
    const { id } = await createApiReminder(owner);
    const now = new Date('2026-10-21T12:00:00.000Z');
    const results = await Promise.all(
      Array.from({ length: 8 }, () => completeReminder(owner.userId, id, now)),
    );
    for (const result of results) completionIds.push(new mongoose.Types.ObjectId(result.id));
    expect(new Set(results.map(({ id: completionId }) => completionId)).size).toBe(1);
    expect(
      await ReminderCompletion.countDocuments({
        reminderId: new mongoose.Types.ObjectId(id),
        monthKey: results[0].monthKey,
      }),
    ).toBe(1);
  });

  it('deactivates one-time reminders and preserves completion history after archive', async () => {
    const now = new Date();
    const today = formatUtcDateOnly(getCurrentJalaliMonthRange(now).today);
    const { id } = await createApiReminder(owner, {
      recurrence: 'none',
      date: today,
    });
    const response = await authenticatedMutation(
      'post',
      `/api/v1/reminders/${id}/complete`,
      owner,
      {},
    );
    expect(response.status).toBe(200);
    const completionId = response.body.data.completion.id as string;
    completionIds.push(new mongoose.Types.ObjectId(completionId));

    const listed = await authenticatedGet('/api/v1/reminders', owner);
    const completedReminder = listed.body.data.reminders.find(
      ({ id: reminderId }: { id: string }) => reminderId === id,
    );
    expect(completedReminder).toMatchObject({ isActive: false, isCompleted: true });

    await Reminder.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: { isActive: true } },
    );
    expect(
      (await getUpcomingReminders(owner.userId, now)).map(({ id: reminderId }) => reminderId),
    ).not.toContain(id);
    const laterMonth = getJalaliMonthRange(1406, 1);
    const retryAfterMonthChange = await completeReminder(
      owner.userId,
      id,
      new Date(laterMonth.startDate.getTime() + 5 * 86_400_000),
    );
    expect(retryAfterMonthChange.id).toBe(completionId);
    expect(retryAfterMonthChange.monthKey).toBe(response.body.data.completion.monthKey);
    expect(
      (await Reminder.findById(id).lean())?.isActive,
    ).toBe(false);
    expect(
      await ReminderCompletion.countDocuments({ reminderId: new mongoose.Types.ObjectId(id) }),
    ).toBe(1);

    const nextMonth = getJalaliMonthRange(1406, 1);
    const afterYearChange = await listReminders(
      owner.userId,
      new Date(nextMonth.startDate.getTime() + 5 * 86_400_000),
    );
    expect(afterYearChange.reminders.find((item) => item.id === id)).toMatchObject({
      isActive: false,
      isCompleted: true,
    });

    const archive = await authenticatedMutation('delete', `/api/v1/reminders/${id}`, owner);
    expect(archive.status).toBe(200);
    expect(
      await ReminderCompletion.countDocuments({ _id: new mongoose.Types.ObjectId(completionId) }),
    ).toBe(1);
    expect((await authenticatedMutation('post', `/api/v1/reminders/${id}/complete`, owner, {}))
      .status).toBe(404);
  });

  it('rejects cross-user updates, completion, and deletion without exposing the reminder', async () => {
    const { id } = await createApiReminder(owner);
    const update = await authenticatedMutation('patch', `/api/v1/reminders/${id}`, otherUser, {
      title: 'غیرمجاز',
    });
    const complete = await authenticatedMutation(
      'post',
      `/api/v1/reminders/${id}/complete`,
      otherUser,
      {},
    );
    const remove = await authenticatedMutation('delete', `/api/v1/reminders/${id}`, otherUser);
    expect(update.status).toBe(404);
    expect(complete.status).toBe(404);
    expect(remove.status).toBe(404);
    expect(
      await ReminderCompletion.countDocuments({ reminderId: new mongoose.Types.ObjectId(id) }),
    ).toBe(0);
  });

  it('retains legacy yearly reminders without allowing new yearly behavior', async () => {
    const legacy = await Reminder.create({
      userId: new mongoose.Types.ObjectId(owner.userId),
      title: `Legacy ${randomUUID()}`,
      date: new Date('2026-10-21T00:00:00.000Z'),
      recurrence: 'yearly',
    });
    reminderIds.push(legacy._id);
    const completion = await authenticatedMutation(
      'post',
      `/api/v1/reminders/${legacy.id}/complete`,
      owner,
      {},
    );
    expect(completion.status).toBe(409);
    expect(completion.body.error.code).toBe('LEGACY_REMINDER_RECURRENCE_UNSUPPORTED');
    expect((await Reminder.findById(legacy._id).lean())?.recurrence).toBe('yearly');
  });

  it('shows only actionable due reminders within seven days on the dashboard', async () => {
    const now = new Date('2026-10-21T12:00:00.000Z');
    const current = await listReminders(owner.userId, now);
    expect(current.monthKey).toBe(formatJalaliMonthKey(1405, 7));
    const candidateDate = getMonthlyOccurrenceDate(
      new Date(`${formatUtcDateOnly(now)}T00:00:00.000Z`),
      1405,
      7,
    );
    expect(candidateDate).toBeDefined();
    const { id } = await createApiReminder(owner, {
      date: formatUtcDateOnly(candidateDate!),
      recurrence: 'monthly',
    });
    const upcoming = await getUpcomingReminders(owner.userId, now);
    expect(upcoming.map(({ id: reminderId }) => reminderId)).toContain(id);
  });
});
