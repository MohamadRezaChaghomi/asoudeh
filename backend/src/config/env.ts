import 'dotenv/config';

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
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
};
