import { appDataSource } from './data-source';

async function runMigrations(): Promise<void> {
  await appDataSource.initialize();
  await appDataSource.runMigrations();
  await appDataSource.destroy();
  console.log('Migrations executed successfully.');
}

runMigrations().catch(async (error: unknown) => {
  console.error('Migration run failed:', error);
  if (appDataSource.isInitialized) {
    await appDataSource.destroy();
  }
  process.exit(1);
});
