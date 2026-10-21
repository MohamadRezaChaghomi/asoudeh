import { z } from 'zod';

const categoryTypeSchema = z.enum(['income', 'expense']);

export const createCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(50),
    type: categoryTypeSchema,
    icon: z.string().trim().min(1).optional(),
  })
  .strict();

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(50).optional(),
    icon: z.string().trim().min(1).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0);

export const categoryParamsSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
