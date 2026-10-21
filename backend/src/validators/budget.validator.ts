import { z } from 'zod';
import { getJalaliMonthRange } from '../utils/jalaliMonth.js';

const MAX_BUDGET_AMOUNT = 1_000_000_000_000;
const categoryIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/);

const monthKeySchema = z
  .string()
  .regex(/^(0[1-9]|1[0-2])-(12\d{2}|13\d{2}|14\d{2}|15\d{2}|1600)$/)
  .superRefine((monthKey, context) => {
    const [month, year] = monthKey.split('-').map(Number);
    try {
      getJalaliMonthRange(year, month);
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'ماه شمسی معتبر نیست.',
      });
    }
  });

const budgetFields = {
  categoryId: categoryIdSchema,
  monthKey: monthKeySchema,
  limitAmount: z.number().int().safe().min(1).max(MAX_BUDGET_AMOUNT),
};

export const createBudgetSchema = z.object(budgetFields).strict();

export const updateBudgetSchema = z
  .object({
    categoryId: budgetFields.categoryId.optional(),
    limitAmount: budgetFields.limitAmount.optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0);

export const budgetParamsSchema = z.object({
  id: categoryIdSchema,
});

export const budgetQuerySchema = z
  .object({
    month: monthKeySchema,
  })
  .strict();

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
export type BudgetQuery = z.infer<typeof budgetQuerySchema>;
