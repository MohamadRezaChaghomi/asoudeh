import 'dotenv/config';
import { z } from 'zod';

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
        message: 'must be an origin without credentials, path, query, or fragment.',
      });
    }

    if (config.NODE_ENV !== 'production') {
      return;
    }

    if (Buffer.byteLength(config.JWT_SECRET, 'utf8') < 32) {
      context.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'must be at least 32 bytes in production.',
      });
    }

    if (!config.AUTH_HASH_SECRET || Buffer.byteLength(config.AUTH_HASH_SECRET, 'utf8') < 32) {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_HASH_SECRET'],
        message: 'must be set to at least 32 bytes in production.',
      });
    } else if (config.AUTH_HASH_SECRET === config.JWT_SECRET) {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_HASH_SECRET'],
        message: 'must be distinct from JWT_SECRET in production.',
      });
    }

    if (clientUrl.protocol !== 'https:') {
      context.addIssue({
        code: 'custom',
        path: ['CLIENT_URL'],
        message: 'must use HTTPS in production.',
      });
    }

    if (config.OTP_DEV_SIMULATOR_ENABLED === 'true') {
      context.addIssue({
        code: 'custom',
        path: ['OTP_DEV_SIMULATOR_ENABLED'],
        message: 'must be disabled in production.',
      });
    }
  });

export function parseEnvironment(input: NodeJS.ProcessEnv) {
  const parsed = environmentSchema.safeParse(input);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map(({ path, message }) => `${path.join('.') || 'environment'} ${message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
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
