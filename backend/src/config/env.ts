import 'dotenv/config';

const otpDevFallbackCode = process.env.OTP_DEV_FALLBACK_CODE ?? '123456';
if (!/^\d{6}$/.test(otpDevFallbackCode)) {
  throw new Error('OTP_DEV_FALLBACK_CODE must be exactly six digits.');
}

const otpResendCooldownSeconds = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS ?? 60);
if (!Number.isInteger(otpResendCooldownSeconds) || otpResendCooldownSeconds < 1) {
  throw new Error('OTP_RESEND_COOLDOWN_SECONDS must be a positive integer.');
}

const otpDevQuickLoginPhone = process.env.OTP_DEV_QUICK_LOGIN_PHONE ?? '09120000000';
if (!/^09\d{9}$/.test(otpDevQuickLoginPhone)) {
  throw new Error('OTP_DEV_QUICK_LOGIN_PHONE must be a valid Iranian mobile number.');
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
  otpDevQuickLoginEnabled:
    process.env.NODE_ENV === 'development' &&
    process.env.OTP_DEV_QUICK_LOGIN_ENABLED === 'true',
  otpDevQuickLoginPhone,
  otpDevFallbackCode,
  otpResendCooldownSeconds,
  smsIrApiKey: process.env.SMSIR_API_KEY?.trim() || undefined,
  smsIrTemplateId: process.env.SMSIR_TEMPLATE_ID?.trim() || undefined,
  smsIrBaseUrl: process.env.SMSIR_BASE_URL ?? 'https://api.sms.ir/v1',
  smsIrMode,
  smsIrOtpParameterName: process.env.SMSIR_OTP_PARAMETER_NAME?.trim() || undefined,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
};
