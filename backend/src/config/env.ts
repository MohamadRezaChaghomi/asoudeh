import 'dotenv/config';

const otpDevFallbackCode = process.env.OTP_DEV_FALLBACK_CODE ?? '123456';
if (!/^\d{6}$/.test(otpDevFallbackCode)) {
  throw new Error('OTP_DEV_FALLBACK_CODE must be exactly six digits.');
}

const otpResendCooldownSeconds = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS ?? 60);
if (!Number.isInteger(otpResendCooldownSeconds) || otpResendCooldownSeconds < 1) {
  throw new Error('OTP_RESEND_COOLDOWN_SECONDS must be a positive integer.');
}

const smsIrMode = process.env.SMSIR_MODE ?? 'sandbox';
if (smsIrMode !== 'sandbox' && smsIrMode !== 'production') {
  throw new Error('SMSIR_MODE must be either sandbox or production.');
}

function requireEnvironmentVariable(key: 'MONGODB_URI' | 'JWT_SECRET'): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }

  return value;
}

export const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: requireEnvironmentVariable('MONGODB_URI'),
  jwtSecret: requireEnvironmentVariable('JWT_SECRET'),
  authHashSecret: process.env.AUTH_HASH_SECRET,
  otpDevSimulatorEnabled: process.env.OTP_DEV_SIMULATOR_ENABLED === 'true',
  otpDevFallbackCode,
  otpResendCooldownSeconds,
  smsIrApiKey: process.env.SMSIR_API_KEY?.trim() || undefined,
  smsIrVerifyTemplateId: process.env.SMSIR_VERIFY_TEMPLATE_ID?.trim() || '123456',
  smsIrMode,
  aiApiKey: process.env.AI_API_KEY?.trim() || undefined,
  aiModel: process.env.AI_MODEL?.trim() || undefined,
  aiBaseUrl: process.env.AI_BASE_URL?.trim() || undefined,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
};
