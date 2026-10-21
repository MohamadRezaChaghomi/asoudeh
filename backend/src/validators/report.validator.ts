import { z } from 'zod';
import { monthKeySchema } from './budget.validator.js';

export const reportQuerySchema = z
  .object({
    month: monthKeySchema.refine((monthKey) => monthKey !== '01-1200', {
      message: 'برای نخستین ماه پشتیبانی‌شده، ماه قبل در دسترس نیست.',
    }),
  })
  .strict();

export type ReportQuery = z.infer<typeof reportQuerySchema>;
