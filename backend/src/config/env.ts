import 'dotenv/config';
import { z } from 'zod';
import { fa, formatZodIssueMessage } from '../messages/fa.js';

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    MONGODB_URI: z.string().min(1),
    JWT_SECRET: z.string().min(1),
    AUTH_HASH_SECRET: z.string().optional(),
    CLIENT_URL: z.string().url().default('http://localhost:3000'),
    PORT: z.coerce.number().int().positive().default(5000),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(1),
    OTP_DEV_SIMULATOR_ENABLED: z.enum(['true', 'false']).default('false'),
    OTP_DEV_FALLBACK_CODE: z.string().regex(/^\d{6}$/).default('123456'),
    OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),
    SMSIR_MODE: z.enum(['sandbox', 'production']).default('sandbox'),
    SMSIR_API_KEY: z.string().optional(),
    SMSIR_VERIFY_TEMPLATE_ID: z.string().optional(),
    AI_API_KEY: z.string().optional(),
    AI_MODEL: z.string().optional(),
    AI_BASE_URL: z.string().optional(),
  })
  .superRefine((config, context) => {
    const clientUrl = new URL(config.CLIENT_URL);
    if (
      clientUrl.username ||
      clientUrl.password ||
      clientUrl.pathname !== '/' ||
      clientUrl.search ||
      clientUrl.hash
    ) {
      context.addIssue({
        code: 'custom',
        path: ['CLIENT_URL'],
        message: 'نشانی کاربر باید فقط مبدأ باشد و نباید شامل مسیر، شناسه، پرس‌وجو یا بخش پایانی باشد.',
      });
    }

    if (config.NODE_ENV !== 'production') {
      return;
    }

    if (Buffer.byteLength(config.JWT_SECRET, 'utf8') < 32) {
      context.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'در محیط عملیاتی باید دست‌کم ۳۲ بایت باشد.',
      });
    }

    if (!config.AUTH_HASH_SECRET || Buffer.byteLength(config.AUTH_HASH_SECRET, 'utf8') < 32) {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_HASH_SECRET'],
        message: 'در محیط عملیاتی باید تنظیم شود و دست‌کم ۳۲ بایت باشد.',
      });
    } else if (config.AUTH_HASH_SECRET === config.JWT_SECRET) {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_HASH_SECRET'],
        message: 'در محیط عملیاتی باید با کلید نشست متفاوت باشد.',
      });
    }

    if (clientUrl.protocol !== 'https:') {
      context.addIssue({
        code: 'custom',
        path: ['CLIENT_URL'],
        message: 'در محیط عملیاتی باید از HTTPS استفاده کند.',
      });
    }

    if (config.OTP_DEV_SIMULATOR_ENABLED === 'true') {
      context.addIssue({
        code: 'custom',
        path: ['OTP_DEV_SIMULATOR_ENABLED'],
        message: 'در محیط عملیاتی باید غیرفعال باشد.',
      });
    }
  });

export function parseEnvironment(input: NodeJS.ProcessEnv) {
  const parsed = environmentSchema.safeParse(input);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map(({ path, code, message }) =>
        `${path.join('.') || 'پیکربندی'} ${formatZodIssueMessage({ code, message })}`,
      )
      .join('; ');
    throw new Error(`${fa.errors.configuration} ${issues}`);
  }

  return parsed.data;
}

const config = parseEnvironment(process.env);

export const env = {
  port: config.PORT,
  nodeEnv: config.NODE_ENV,
  mongoUri: config.MONGODB_URI,
  jwtSecret: config.JWT_SECRET,
  authHashSecret: config.AUTH_HASH_SECRET,
  otpDevSimulatorEnabled: config.OTP_DEV_SIMULATOR_ENABLED === 'true',
  otpDevFallbackCode: config.OTP_DEV_FALLBACK_CODE,
  otpResendCooldownSeconds: config.OTP_RESEND_COOLDOWN_SECONDS,
  trustProxyHops: config.TRUST_PROXY_HOPS,
  smsIrApiKey: config.SMSIR_API_KEY?.trim() || undefined,
  smsIrVerifyTemplateId: config.SMSIR_VERIFY_TEMPLATE_ID?.trim() || '123456',
  smsIrMode: config.SMSIR_MODE,
  aiApiKey: config.AI_API_KEY?.trim() || undefined,
  aiModel: config.AI_MODEL?.trim() || undefined,
  aiBaseUrl: config.AI_BASE_URL?.trim() || undefined,
  clientUrl: new URL(config.CLIENT_URL).origin,
};
