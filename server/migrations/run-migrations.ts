/**
 * Run all migrations in sequence
 */

import { runMigrations as runExistingMigrations } from './add-missing-columns';
import { addLmsTables } from './add-lms-tables';
import { logger } from '../lib/logger';

export async function runMigrations() {
  try {
    // Run existing migrations
    await runExistingMigrations();
    
    // Run LMS table migrations only if tables don't exist
    try {
      await addLmsTables();
    } catch (error) {
      // If tables already exist, this is expected - log and continue
      if (error instanceof Error && error.message.includes('already exists')) {
        logger.info('LMS tables already exist, skipping migration');
      } else {
        logger.warn('LMS migration error (possibly already migrated)', { error: error.message });
      }
    }
    
    console.log('All migrations completed successfully!');
  } catch (error) {
    console.error('Error during migrations:', error);
  }
}