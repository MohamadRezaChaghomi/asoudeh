import app from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';

async function bootstrap() {
  await connectDB();
  app.listen(env.port, () => {
    console.log(`Asoudeh API running on http://localhost:${env.port}`);
  });
}

bootstrap().catch((error) => {
  console.error('Server startup failed:', error);
  process.exit(1);
});
