import { z } from 'zod';
import { normalizeIranianMobile } from '../utils/authCrypto.js';

const mobileSchema = z
  .string()
  .trim()
  .transform((value) => normalizeIranianMobile(value))
  .refine((value): value is string => value !== null, {
    message: 'شماره همراه معتبر ایرانی وارد کنید.',
  });

const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'نام نمایشی را وارد کنید.')
  .max(80, 'نام نمایشی باید حداکثر ۸۰ نویسه باشد.');

const currentSolarHijriYear = Number(
  new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric' })
    .format(new Date())
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0)),
);

const birthYearSchema = z
  .number()
  .int('سال تولد باید عدد صحیح باشد.')
  .min(1300, 'سال تولد نمی‌تواند پیش از ۱۳۰۰ باشد.')
  .max(currentSolarHijriYear, 'سال تولد نمی‌تواند در آینده باشد.');

const accessibilitySchema = z
  .object({
    fontScale: z.union([z.literal(1), z.literal(1.25), z.literal(1.5), z.literal(2)]),
    highContrast: z.boolean(),
  })
  .partial();

export const requestOtpSchema = z.object({
  phone: mobileSchema,
});

export const verifyOtpSchema = z.object({
  phone: mobileSchema,
  code: z.string().regex(/^\d{6}$/, 'کد تأیید باید ۶ رقم باشد.'),
});

export const completeRegistrationSchema = z.object({
  displayName: displayNameSchema,
});

export const updateProfileSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    birthYear: birthYearSchema.nullable().optional(),
    initialBalance: z
      .number()
      .int('موجودی اولیه باید عدد صحیح به تومان باشد.')
      .nonnegative('موجودی اولیه نمی‌تواند منفی باشد.')
      .safe('موجودی اولیه بیش از حد بزرگ است.')
      .optional(),
    accessibilitySettings: accessibilitySchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'حداقل یک مورد برای ویرایش انتخاب کنید.',
  });

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type CompleteRegistrationInput = z.infer<typeof completeRegistrationSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
