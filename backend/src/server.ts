import app from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { purgeExpiredAccountDeletions } from './services/accountDeletion.service.js';

const ACCOUNT_DELETION_CHECK_INTERVAL_MS = 60_000;

function startAccountDeletionWorker(): void {
  const processDueAccounts = () => {
    void purgeExpiredAccountDeletions().catch((error: unknown) => {
      console.error('Account deletion worker failed.', {
        errorType: error instanceof Error ? error.name : 'UnknownError',
      });
    });
  };

  processDueAccounts();
  const interval = setInterval(processDueAccounts, ACCOUNT_DELETION_CHECK_INTERVAL_MS);
  interval.unref();
}

async function bootstrap(): Promise<void> {
  await connectDB();
  startAccountDeletionWorker();
  app.listen(env.port, () => {
    console.log(`Asoudeh API running on http://localhost:${env.port}`);
  });
}

bootstrap().catch((error: unknown) => {
  console.error('Server startup failed.', {
    errorType: error instanceof Error ? error.name : 'UnknownError',
  });
  process.exit(1);
});
