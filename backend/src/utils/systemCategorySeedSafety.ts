export interface SystemCategorySeedEnvironment {
  nodeEnv: string | undefined;
  confirmation: string | undefined;
  uri: string | undefined;
}

export function validateSystemCategorySeedTarget({
  nodeEnv,
  confirmation,
  uri,
}: SystemCategorySeedEnvironment): string {
  if (nodeEnv !== 'development') {
    throw new Error('System category seeding is allowed only when NODE_ENV=development.');
  }
  if (confirmation !== 'seed-default-categories') {
    throw new Error('Set SEED_CONFIRMATION=seed-default-categories to confirm this operation.');
  }
  if (!uri) {
    throw new Error('SEED_MONGODB_URI must explicitly target the local asoudeh_dev database.');
  }

  const parsed = new URL(uri);
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
      'Refusing to seed: SEED_MONGODB_URI must be a credential-free local URI for asoudeh_dev.',
    );
  }

  return uri;
}
