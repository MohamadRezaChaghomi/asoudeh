import { z } from 'zod';
import { normalizeIranianMobile } from '../utils/authCrypto.js';
import { reportQuerySchema } from './report.validator.js';
import { transactionQuerySchema } from './transaction.validator.js';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/);

const phoneSchema = z
  .string()
  .trim()
  .transform((value) => normalizeIranianMobile(value))
  .refine((value): value is string => value !== null, {
    message: 'شماره همراه معتبر ایرانی وارد کنید.',
  });

export const caregiverPermissionSchema = z.enum([
  'VIEW_SUMMARY',
  'VIEW_TRANSACTIONS',
  'VIEW_REPORTS',
]);

export const inviteCaregiverSchema = z
  .object({
    phone: phoneSchema,
    permissions: z.array(caregiverPermissionSchema).min(1).max(3),
  })
  .strict()
  .refine((input) => new Set(input.permissions).size === input.permissions.length, {
    message: 'مجوز تکراری است.',
    path: ['permissions'],
  });

export const caregiverDecisionSchema = z
  .object({
    decision: z.enum(['accept', 'reject']),
  })
  .strict();

export const caregiverLinkParamsSchema = z.object({
  id: objectIdSchema,
});

export const caregiverSeniorParamsSchema = z.object({
  seniorId: objectIdSchema,
});

export const caregiverTransactionQuerySchema = transactionQuerySchema;
export const caregiverReportQuerySchema = reportQuerySchema;

export type InviteCaregiverInput = z.infer<typeof inviteCaregiverSchema>;
export type CaregiverDecisionInput = z.infer<typeof caregiverDecisionSchema>;
export type CaregiverPermission = z.infer<typeof caregiverPermissionSchema>;
