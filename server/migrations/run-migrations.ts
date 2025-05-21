/**
 * Run all migrations in sequence
 */

import { addMissingColumns } from './add-missing-columns';
import { addLmsTables } from './add-lms-tables';

export async function runMigrations() {
  try {
    // Run existing migrations
    await addMissingColumns();
    
    // Run new LMS migrations
    await addLmsTables();
    
    console.log('All migrations completed successfully!');
  } catch (error) {
    console.error('Error during migrations:', error);
  }
}