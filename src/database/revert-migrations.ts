import { appDataSource } from './data-source';

async function revertMigrations(): Promise<void> {
  await appDataSource.initialize();
  await appDataSource.undoLastMigration();
  await appDataSource.destroy();
  console.log('Last migration reverted successfully.');
}

revertMigrations().catch(async (error: unknown) => {
  console.error('Migration revert failed:', error);
  if (appDataSource.isInitialized) {
    await appDataSource.destroy();
  }
  process.exit(1);
});
