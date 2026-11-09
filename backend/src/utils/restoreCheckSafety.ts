export function requireLocalRestoreCheckUri(uri: string | undefined): string {
  if (!uri) throw new Error('RESTORE_CHECK_MONGODB_URI is required.');

  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error('Restore integrity checks are restricted to local asoudeh_restore_check.');
  }
  if (
    parsed.protocol !== 'mongodb:' ||
    !['127.0.0.1', 'localhost'].includes(parsed.hostname) ||
    parsed.port !== '27017' ||
    decodeURIComponent(parsed.pathname.slice(1)) !== 'asoudeh_restore_check' ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error('Restore integrity checks are restricted to local asoudeh_restore_check.');
  }
  return uri;
}
