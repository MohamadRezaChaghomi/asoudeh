export interface TestUserSeedEnvironment {
  nodeEnv: string | undefined;
  confirmation: string | undefined;
  otpSimulatorEnabled: string | undefined;
  uri: string | undefined;
}

export function validateTestUserSeedTarget({
  nodeEnv,
  confirmation,
  otpSimulatorEnabled,
  uri,
}: TestUserSeedEnvironment): string {
  if (nodeEnv !== 'development') {
    throw new Error('Test-user seeding is allowed only when NODE_ENV=development.');
  }
  if (confirmation !== 'seed-test-users') {
    throw new Error('Set SEED_TEST_USERS_CONFIRMATION=seed-test-users to confirm this operation.');
  }
  if (otpSimulatorEnabled !== 'true') {
    throw new Error('Test-user seeding requires OTP_DEV_SIMULATOR_ENABLED=true.');
  }
  if (!uri) {
    throw new Error('MONGODB_URI must explicitly target local asoudeh_dev.');
  }

  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error('Refusing to seed: MONGODB_URI is not a valid MongoDB URI.');
  }

  if (
    parsed.protocol !== 'mongodb:' ||
    !['127.0.0.1', 'localhost'].includes(parsed.hostname) ||
    parsed.port !== '27017' ||
    decodeURIComponent(parsed.pathname.slice(1)) !== 'asoudeh_dev' ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(
      'Refusing to seed: MONGODB_URI must be a credential-free local URI for asoudeh_dev.',
    );
  }

  return uri;
}
