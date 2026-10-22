import { z } from 'zod';
import { formatUtcDateOnly, getCurrentJalaliMonthRange } from '../utils/jalaliMonth.js';

const MAX_TRANSACTION_AMOUNT = 1_000_000_000_000;

function parseDateOnly(value: string, context: z.RefinementCtx): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'تاریخ معتبر نیست.' });
    return z.NEVER;
  }

  if (value > formatUtcDateOnly(getCurrentJalaliMonthRange().today)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'تاریخ آینده قابل ثبت نیست.' });
    return z.NEVER;
  }

  return date;
}

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .transform(parseDateOnly);

const categoryIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/);

const transactionFields = {
  type: z.enum(['income', 'expense']),
  amount: z.number().int().safe().min(1).max(MAX_TRANSACTION_AMOUNT),
  categoryId: categoryIdSchema,
  date: dateOnlySchema,
  note: z.string().trim().max(200).optional(),
};

export const createTransactionSchema = z.object(transactionFields).strict();

export const updateTransactionSchema = z
  .object({
    ...transactionFields,
    type: transactionFields.type.optional(),
    amount: transactionFields.amount.optional(),
    categoryId: transactionFields.categoryId.optional(),
    date: transactionFields.date.optional(),
    note: transactionFields.note,
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0);

export const transactionParamsSchema = z.object({
  id: categoryIdSchema,
});

export const transactionQuerySchema = z
  .object({
    type: z.enum(['income', 'expense']).optional(),
    categoryId: categoryIdSchema.optional(),
    from: dateOnlySchema.optional(),
    to: dateOnlySchema.optional(),
    search: z.string().trim().max(100).optional(),
    sortBy: z.enum(['date', 'amount']).default('date'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().positive().max(10_000).default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
  })
  .strict()
  .refine(
    ({ from, to }) => !from || !to || from.getTime() <= to.getTime(),
    { message: 'بازهٔ تاریخ معتبر نیست.', path: ['to'] },
  );

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type TransactionQuery = z.infer<typeof transactionQuerySchema>;
