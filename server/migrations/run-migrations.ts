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
      // Check if LMS tables already exist to avoid syntax errors
      const result = await db.execute(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name LIKE 'lms_%'
      `);
      
      if (result.rows.length === 0) {
        await addLmsTables();
      } else {
        logger.info('LMS tables already exist, skipping migration');
      }
    } catch (error) {
      logger.warn('LMS migration error (possibly already migrated)', { error: error.message });
    }
    
    console.log('All migrations completed successfully!');
  } catch (error) {
    console.error('Error during migrations:', error);
  }
}