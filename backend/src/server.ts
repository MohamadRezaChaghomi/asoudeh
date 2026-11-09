import { createServer, type Server } from 'node:http';
import mongoose from 'mongoose';
import app from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { purgeExpiredAccountDeletions } from './services/accountDeletion.service.js';
import { logger } from './utils/logger.js';

const ACCOUNT_DELETION_CHECK_INTERVAL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 30_000;
const HEADERS_TIMEOUT_MS = 15_000;
let server: Server | undefined;
let accountDeletionInterval: NodeJS.Timeout | undefined;
let shuttingDown = false;

function startAccountDeletionWorker(): NodeJS.Timeout {
  const processDueAccounts = () => {
    void purgeExpiredAccountDeletions().catch((error: unknown) => {
      logger.error(
        { errorType: error instanceof Error ? error.name : 'UnknownError' },
        'account_deletion_worker_failed',
      );
    });
  };

  processDueAccounts();
  const interval = setInterval(processDueAccounts, ACCOUNT_DELETION_CHECK_INTERVAL_MS);
  interval.unref();
  return interval;
}

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutdown_started');
  if (accountDeletionInterval) clearInterval(accountDeletionInterval);

  try {
    if (server?.listening) {
      await new Promise<void>((resolve, reject) => {
        server?.close((error) => (error ? reject(error) : resolve()));
      });
    }
  } catch (error) {
    logger.error(
      { signal, errorType: error instanceof Error ? error.name : 'UnknownError' },
      'http_server_close_failed',
    );
    process.exitCode = 1;
  }

  try {
    await mongoose.disconnect();
    logger.info({ signal }, 'shutdown_complete');
  } catch (error) {
    logger.error(
      { signal, errorType: error instanceof Error ? error.name : 'UnknownError' },
      'mongodb_disconnect_failed',
    );
    process.exitCode = 1;
  }
}

async function bootstrap(): Promise<void> {
  await connectDB();
  if (shuttingDown) {
    await mongoose.disconnect();
    return;
  }
  accountDeletionInterval = startAccountDeletionWorker();
  server = createServer(app).listen(env.port, () => {
    logger.info({ port: env.port }, 'server_listening');
  });
  server.requestTimeout = REQUEST_TIMEOUT_MS;
  server.headersTimeout = HEADERS_TIMEOUT_MS;
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason: unknown) => {
  logger.fatal(
    { errorType: reason instanceof Error ? reason.name : 'UnknownError' },
    'unhandled_rejection',
  );
  process.exitCode = 1;
  void shutdown('unhandledRejection');
});
process.on('uncaughtException', (error: Error) => {
  logger.fatal({ errorType: error.name }, 'uncaught_exception');
  process.exitCode = 1;
  void shutdown('uncaughtException');
});

bootstrap().catch((error: unknown) => {
  logger.fatal(
    { errorType: error instanceof Error ? error.name : 'UnknownError' },
    'server_startup_failed',
  );
  process.exitCode = 1;
  void shutdown('startup_failure');
});
