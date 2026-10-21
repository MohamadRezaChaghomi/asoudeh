import { z } from 'zod';
import { formatUtcDateOnly } from '../utils/jalaliMonth.js';

const MAX_REMINDER_AMOUNT = 1_000_000_000_000;
const reminderIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/);

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .transform((value, context) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || formatUtcDateOnly(date) !== value) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'تاریخ معتبر نیست.' });
      return z.NEVER;
    }
    return date;
  });

const titleSchema = z.string().trim().min(1).max(120);
const amountSchema = z.number().int().safe().min(1).max(MAX_REMINDER_AMOUNT);
const recurrenceSchema = z.enum(['none', 'monthly']);

export const createReminderSchema = z
  .object({
    title: titleSchema,
    date: dateOnlySchema,
    amount: amountSchema.optional(),
    recurrence: recurrenceSchema,
  })
  .strict();

export const updateReminderSchema = z
  .object({
    title: titleSchema.optional(),
    date: dateOnlySchema.optional(),
    amount: amountSchema.nullable().optional(),
    recurrence: recurrenceSchema.optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0);

export const reminderParamsSchema = z.object({ id: reminderIdSchema });
export const completeReminderSchema = z.object({}).strict();

export type CreateReminderInput = z.infer<typeof createReminderSchema>;
export type UpdateReminderInput = z.infer<typeof updateReminderSchema>;
