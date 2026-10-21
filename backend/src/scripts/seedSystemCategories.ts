import mongoose from 'mongoose';
import { seedSystemCategories } from '../services/categories.service.js';
import { validateSystemCategorySeedTarget } from '../utils/systemCategorySeedSafety.js';

async function main(): Promise<void> {
  const uri = validateSystemCategorySeedTarget({
    nodeEnv: process.env.NODE_ENV,
    confirmation: process.env.SEED_CONFIRMATION,
    uri: process.env.SEED_MONGODB_URI,
  });
  await mongoose.connect(uri);
  const insertedCount = await seedSystemCategories();
  console.log(`System categories ready; inserted ${insertedCount} missing categories.`);
}

main()
  .catch((error: unknown) => {
    console.error('System category seeding failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
