import type { Request, RequestHandler } from 'express';
import {
  completeReminder,
  createReminder,
  deleteReminder,
  listReminders,
  updateReminder,
} from '../services/reminders.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import type {
  CreateReminderInput,
  UpdateReminderInput,
} from '../validators/reminder.validator.js';

function requireUserId(req: Request): string {
  if (!req.user) {
    throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'برای ادامه وارد حساب خود شوید.');
  }
  return req.user.userId;
}

export const getReminders: RequestHandler = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await listReminders(requireUserId(req)),
  });
});

export const postReminder: RequestHandler = asyncHandler(async (req, res) => {
  const reminder = await createReminder(
    requireUserId(req),
    req.body as CreateReminderInput,
  );
  res.status(201).json({ success: true, data: { reminder } });
});

export const patchReminder: RequestHandler = asyncHandler(async (req, res) => {
  const reminder = await updateReminder(
    requireUserId(req),
    req.params.id,
    req.body as UpdateReminderInput,
  );
  res.json({ success: true, data: { reminder } });
});

export const completeReminderHandler: RequestHandler = asyncHandler(async (req, res) => {
  const completion = await completeReminder(requireUserId(req), req.params.id);
  res.json({
    success: true,
    data: { completion },
    message: 'یادآور انجام شد.',
  });
});

export const removeReminder: RequestHandler = asyncHandler(async (req, res) => {
  await deleteReminder(requireUserId(req), req.params.id);
  res.json({ success: true, message: 'یادآور بایگانی شد.' });
});
