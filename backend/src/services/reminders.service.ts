import mongoose from 'mongoose';
import Reminder from '../models/Reminder.js';
import ReminderCompletion from '../models/ReminderCompletion.js';
import { HttpError } from '../utils/httpError.js';
import {
  formatJalaliMonthKey,
  formatUtcDateOnly,
  getCurrentJalaliMonthRange,
  getJalaliDateParts,
  getJalaliMonthRange,
  getMonthlyOccurrenceDate,
} from '../utils/jalaliMonth.js';
import type {
  CreateReminderInput,
  UpdateReminderInput,
} from '../validators/reminder.validator.js';

type ReminderRecurrence = 'none' | 'monthly' | 'yearly';

interface ReminderDocument {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  title: string;
  date: Date;
  recurrence: ReminderRecurrence;
  amount?: number;
  isActive: boolean;
  deletedAt?: Date | null;
}

interface CompletionDocument {
  _id: mongoose.Types.ObjectId;
  reminderId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  monthKey: string;
  completedAt: Date;
}

export interface ReminderResponse {
  id: string;
  title: string;
  date: string;
  nextDueDate: string;
  recurrence: ReminderRecurrence;
  amount?: number;
  isActive: boolean;
  isCompleted: boolean;
  completedAt?: string;
}

export interface UpcomingReminderResponse {
  id: string;
  title: string;
  date: string;
  recurrence: ReminderRecurrence;
  amount?: number;
}

export interface ReminderCompletionResponse {
  id: string;
  reminderId: string;
  monthKey: string;
  completedAt: string;
}

function toReminderResponse(
  reminder: ReminderDocument,
  currentMonthCompletions: Map<string, CompletionDocument>,
  anyCompletionIds: Set<string>,
  historicalCompletions: Map<string, CompletionDocument>,
  today: Date,
): ReminderResponse {
  const current = currentMonthCompletions.get(reminder._id.toString());
  const historical = historicalCompletions.get(reminder._id.toString());
  const isCompleted =
    reminder.recurrence === 'monthly'
      ? Boolean(current)
      : reminder.recurrence === 'none'
        ? anyCompletionIds.has(reminder._id.toString())
        : false;

  let nextDue = reminder.date;
  if (reminder.recurrence === 'monthly') {
    const currentParts = getJalaliDateParts(today);
    const currentOccurrence = getMonthlyOccurrenceDate(
      reminder.date,
      currentParts.year,
      currentParts.month,
    );
    if (currentOccurrence && currentOccurrence >= today) {
      nextDue = currentOccurrence;
    } else {
      const nextYear = currentParts.month === 12 ? currentParts.year + 1 : currentParts.year;
      const nextMonth = currentParts.month === 12 ? 1 : currentParts.month + 1;
      nextDue =
        getMonthlyOccurrenceDate(reminder.date, nextYear, nextMonth) ??
        reminder.date;
    }
  }

  return {
    id: reminder._id.toString(),
    title: reminder.title,
    date: formatUtcDateOnly(reminder.date),
    nextDueDate: formatUtcDateOnly(nextDue),
    recurrence: reminder.recurrence,
    ...(reminder.amount === undefined ? {} : { amount: reminder.amount }),
    isActive: reminder.isActive,
    isCompleted,
    ...(current || (reminder.recurrence === 'none' ? historical : undefined)
      ? {
          completedAt: (
            current ?? historical
          )!.completedAt.toISOString(),
        }
      : {}),
  };
}

function completionResponse(
  completion: CompletionDocument,
): ReminderCompletionResponse {
  return {
    id: completion._id.toString(),
    reminderId: completion.reminderId.toString(),
    monthKey: completion.monthKey,
    completedAt: completion.completedAt.toISOString(),
  };
}

function nextMonth(year: number, month: number): { year: number; month: number } {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

function reminderId(value: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(value);
}

export async function listReminders(
  userId: string,
  now = new Date(),
): Promise<{ monthKey: string; reminders: ReminderResponse[] }> {
  const ownerId = reminderId(userId);
  const { year, month, today } = getCurrentJalaliMonthRange(now);
  const monthKey = formatJalaliMonthKey(year, month);
  const reminders = (await Reminder.find({
    userId: ownerId,
    deletedAt: null,
  })
    .sort({ date: 1, _id: 1 })
    .lean()) as ReminderDocument[];
  const ids = reminders.map(({ _id }) => _id);
  const oneTimeIds = reminders
    .filter(({ recurrence }) => recurrence === 'none')
    .map(({ _id }) => _id);
  const [currentCompletions, oneTimeCompletions] = ids.length
    ? await Promise.all([
        ReminderCompletion.find({ userId: ownerId, reminderId: { $in: ids }, monthKey })
          .lean(),
        oneTimeIds.length
          ? ReminderCompletion.find({
              userId: ownerId,
              reminderId: { $in: oneTimeIds },
            }).lean()
          : [],
      ])
    : [[], []];
  const byReminder = new Map(
    (currentCompletions as CompletionDocument[]).map((completion) => [
      completion.reminderId.toString(),
      completion,
    ]),
  );
  const oneTimeCompletionIds = new Set(
    (oneTimeCompletions as CompletionDocument[]).map(({ reminderId: id }) =>
      id.toString(),
    ),
  );
  const latestOneTimeCompletion = new Map<string, CompletionDocument>();
  for (const completion of oneTimeCompletions as CompletionDocument[]) {
    const key = completion.reminderId.toString();
    const previous = latestOneTimeCompletion.get(key);
    if (!previous || completion.completedAt > previous.completedAt) {
      latestOneTimeCompletion.set(key, completion);
    }
  }

  return {
    monthKey,
    reminders: reminders.map((reminder) =>
      toReminderResponse(
        reminder,
        byReminder,
        oneTimeCompletionIds,
        latestOneTimeCompletion,
        today,
      ),
    ),
  };
}

export async function createReminder(
  userId: string,
  input: CreateReminderInput,
): Promise<ReminderResponse> {
  const reminder = (await Reminder.create({
    userId: reminderId(userId),
    title: input.title,
    date: input.date,
    recurrence: input.recurrence,
    ...(input.amount === undefined ? {} : { amount: input.amount }),
  })) as ReminderDocument;
  const listed = await listReminders(userId);
  const response = listed.reminders.find(({ id }) => id === reminder._id.toString());
  if (!response) {
    throw new HttpError(500, 'REMINDER_NOT_FOUND_AFTER_SAVE', 'یادآور پس از ذخیره پیدا نشد.');
  }
  return response;
}

export async function updateReminder(
  userId: string,
  id: string,
  input: UpdateReminderInput,
): Promise<ReminderResponse> {
  const { amount, ...fields } = input;
  const update: Record<string, unknown> = { ...fields };
  if (amount !== undefined && amount !== null) update.amount = amount;
  const updateOperators: Record<string, unknown> = { $set: update };
  if (amount === null) updateOperators.$unset = { amount: 1 };

  const reminder = await Reminder.findOneAndUpdate(
    { _id: reminderId(id), userId: reminderId(userId), deletedAt: null },
    updateOperators,
    { new: true, runValidators: true },
  ).lean();
  if (!reminder) {
    throw new HttpError(404, 'REMINDER_NOT_FOUND', 'یادآور پیدا نشد.');
  }

  const listed = await listReminders(userId);
  const response = listed.reminders.find(({ id: reminderIdValue }) => reminderIdValue === id);
  if (!response) {
    throw new HttpError(500, 'REMINDER_NOT_FOUND_AFTER_SAVE', 'یادآور پس از ذخیره پیدا نشد.');
  }
  return response;
}

export async function deleteReminder(userId: string, id: string): Promise<void> {
  const result = await Reminder.updateOne(
    { _id: reminderId(id), userId: reminderId(userId), deletedAt: null },
    { $set: { deletedAt: new Date(), isActive: false } },
  );
  if (result.matchedCount === 0) {
    throw new HttpError(404, 'REMINDER_NOT_FOUND', 'یادآور پیدا نشد.');
  }
}

export async function completeReminder(
  userId: string,
  id: string,
  now = new Date(),
): Promise<ReminderCompletionResponse> {
  const ownerId = reminderId(userId);
  const targetId = reminderId(id);
  const reminder = (await Reminder.findOne({
    _id: targetId,
    userId: ownerId,
    deletedAt: null,
  }).lean()) as ReminderDocument | null;
  if (!reminder) {
    throw new HttpError(404, 'REMINDER_NOT_FOUND', 'یادآور پیدا نشد.');
  }
  if (reminder.recurrence === 'yearly') {
    throw new HttpError(
      409,
      'LEGACY_REMINDER_RECURRENCE_UNSUPPORTED',
      'تکمیل یادآورهای تکرار سالانهٔ قدیمی پشتیبانی نمی‌شود.',
    );
  }

  const { year, month } = getCurrentJalaliMonthRange(now);
  const monthKey = formatJalaliMonthKey(year, month);
  const existingQuery = ReminderCompletion.findOne({
    reminderId: targetId,
    userId: ownerId,
    ...(reminder.recurrence === 'none' ? {} : { monthKey }),
  }).sort({ completedAt: -1 });
  const existing = (await existingQuery.lean()) as CompletionDocument | null;
  if (existing) {
    if (reminder.recurrence === 'none' && reminder.isActive) {
      await Reminder.updateOne(
        { _id: targetId, userId: ownerId, isActive: true, deletedAt: null },
        { $set: { isActive: false } },
      );
    }
    return completionResponse(existing);
  }

  if (!reminder.isActive) {
    throw new HttpError(404, 'REMINDER_NOT_FOUND', 'یادآور فعال پیدا نشد.');
  }

  let completion: CompletionDocument | undefined;
  try {
    completion = (await ReminderCompletion.findOneAndUpdate(
      { reminderId: targetId, monthKey },
      {
        $setOnInsert: {
          userId: ownerId,
          completedAt: now,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean()) as CompletionDocument;
  } catch (error) {
    if (
      !error ||
      typeof error !== 'object' ||
      !('code' in error) ||
      error.code !== 11000
    ) {
      throw error;
    }
    const racedCompletion = (await ReminderCompletion.findOne({
      reminderId: targetId,
      userId: ownerId,
      monthKey,
    }).lean()) as CompletionDocument | null;
    if (!racedCompletion) throw error;
    completion = racedCompletion;
  }
  if (!completion) {
    throw new HttpError(
      500,
      'REMINDER_COMPLETION_NOT_FOUND',
      'سابقهٔ تکمیل یادآور پیدا نشد.',
    );
  }
  if (completion.userId.toString() !== ownerId.toString()) {
    throw new HttpError(
      500,
      'REMINDER_COMPLETION_OWNER_MISMATCH',
      'مالکیت سابقهٔ یادآور معتبر نیست.',
    );
  }

  if (reminder.recurrence === 'none') {
    await Reminder.updateOne(
      { _id: targetId, userId: ownerId, isActive: true, deletedAt: null },
      { $set: { isActive: false } },
    );
  }
  return completionResponse(completion);
}

export async function getUpcomingReminders(
  userId: string,
  now = new Date(),
): Promise<UpcomingReminderResponse[]> {
  const ownerId = reminderId(userId);
  const current = getCurrentJalaliMonthRange(now);
  const next = nextMonth(current.year, current.month);
  const nextRange = getJalaliMonthRange(next.year, next.month);
  const horizonExclusive = new Date(current.today.getTime() + 8 * 86_400_000);
  const reminders = (await Reminder.find({
    userId: ownerId,
    isActive: true,
    deletedAt: null,
    $or: [
      { recurrence: 'monthly', date: { $lt: nextRange.endDateExclusive } },
      {
        recurrence: { $in: ['none', 'yearly'] },
        date: { $gte: current.today, $lt: horizonExclusive },
      },
    ],
  })
    .sort({ date: 1, _id: 1 })
    .lean()) as ReminderDocument[];
  if (!reminders.length) return [];

  const oneTimeIds = reminders
    .filter(({ recurrence }) => recurrence === 'none')
    .map(({ _id }) => _id);
  const monthlyIds = reminders
    .filter(({ recurrence }) => recurrence === 'monthly')
    .map(({ _id }) => _id);
  const monthKeys = [
    formatJalaliMonthKey(current.year, current.month),
    formatJalaliMonthKey(next.year, next.month),
  ];
  const completions = (await ReminderCompletion.find({
    userId: ownerId,
    $or: [
      { reminderId: { $in: oneTimeIds } },
      { reminderId: { $in: monthlyIds }, monthKey: { $in: monthKeys } },
    ],
  }).lean()) as CompletionDocument[];
  const completed = new Set(
    completions.map(({ reminderId: id, monthKey: key }) => `${id.toString()}:${key}`),
  );
  const oneTimeIdSet = new Set(oneTimeIds.map((id) => id.toString()));
  const completedOneTimeIds = new Set(
    completions
      .filter(({ reminderId: id }) => oneTimeIdSet.has(id.toString()))
      .map(({ reminderId: id }) => id.toString()),
  );
  const todayIso = formatUtcDateOnly(current.today);
  const horizonIso = formatUtcDateOnly(new Date(horizonExclusive.getTime() - 86_400_000));
  const candidates: Array<UpcomingReminderResponse & { sortId: string }> = [];

  for (const reminder of reminders) {
    if (reminder.recurrence === 'none' || reminder.recurrence === 'yearly') {
      const dueDate = formatUtcDateOnly(reminder.date);
      if (
        dueDate >= todayIso &&
        dueDate <= horizonIso &&
        !completedOneTimeIds.has(reminder._id.toString())
      ) {
        candidates.push({
          id: reminder._id.toString(),
          title: reminder.title,
          date: dueDate,
          recurrence: reminder.recurrence,
          ...(reminder.amount === undefined ? {} : { amount: reminder.amount }),
          sortId: reminder._id.toString(),
        });
      }
      continue;
    }

    const periods = [
      { ...current, monthKey: monthKeys[0] },
      { ...next, monthKey: monthKeys[1] },
    ];
    for (const period of periods) {
      const due = getMonthlyOccurrenceDate(reminder.date, period.year, period.month);
      if (!due) continue;
      const dueIso = formatUtcDateOnly(due);
      if (
        dueIso < todayIso ||
        dueIso > horizonIso ||
        completed.has(`${reminder._id.toString()}:${period.monthKey}`)
      ) {
        continue;
      }
      candidates.push({
        id: reminder._id.toString(),
        title: reminder.title,
        date: dueIso,
        recurrence: reminder.recurrence,
        ...(reminder.amount === undefined ? {} : { amount: reminder.amount }),
        sortId: reminder._id.toString(),
      });
      break;
    }
  }

  return candidates
    .sort((left, right) => left.date.localeCompare(right.date) || left.sortId.localeCompare(right.sortId))
    .slice(0, 5)
    .map(({ sortId: _sortId, ...reminder }) => reminder);
}
