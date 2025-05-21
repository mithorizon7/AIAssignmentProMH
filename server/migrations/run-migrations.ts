/**
 * Run all migrations in sequence
 */

import { runMigrations as runExistingMigrations } from './add-missing-columns';
import { addLmsTables } from './add-lms-tables';

export async function runMigrations() {
  try {
    // Run existing migrations
    await runExistingMigrations();
    
    // Run new LMS migrations
    await addLmsTables();
    
    console.log('All migrations completed successfully!');
  } catch (error) {
    console.error('Error during migrations:', error);
  }
}