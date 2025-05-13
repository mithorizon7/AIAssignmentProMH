import { db } from '../db';

async function addMissingColumnsToSubmissions() {
  console.log('[Migration] Checking for missing columns in submissions table...');
  
  // First, check if the columns already exist
  const columnsQuery = `
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'submissions' 
    AND column_name IN ('mime_type', 'file_size', 'content_type');
  `;
  
  const result = await db.execute(columnsQuery);
  const existingColumns = result.rows.map(row => row.column_name);
  
  const missingColumns = [];
  
  if (!existingColumns.includes('mime_type')) {
    missingColumns.push('mime_type');
  }
  
  if (!existingColumns.includes('file_size')) {
    missingColumns.push('file_size');
  }
  
  if (!existingColumns.includes('content_type')) {
    missingColumns.push('content_type');
  }
  
  if (missingColumns.length === 0) {
    console.log('[Migration] No missing columns found in submissions table.');
    return;
  }
  
  console.log(`[Migration] Found ${missingColumns.length} missing columns: ${missingColumns.join(', ')}`);
  
  // Add each missing column individually
  for (const column of missingColumns) {
    try {
      let alterStatement = '';
      
      switch (column) {
        case 'mime_type':
          alterStatement = `ALTER TABLE submissions ADD COLUMN mime_type TEXT;`;
          break;
        case 'file_size':
          alterStatement = `ALTER TABLE submissions ADD COLUMN file_size INTEGER;`;
          break;
        case 'content_type':
          // First, check if the enum type exists
          const enumCheckQuery = `
            SELECT EXISTS (
              SELECT 1 FROM pg_type WHERE typname = 'content_type_enum'
            );
          `;
          const enumCheckResult = await db.execute(enumCheckQuery);
          const enumExists = enumCheckResult.rows[0].exists;
          
          if (!enumExists) {
            // Create the enum type first
            await db.execute(`
              CREATE TYPE content_type_enum AS ENUM ('text', 'image', 'audio', 'video', 'document');
            `);
            console.log('[Migration] Created content_type_enum type.');
          }
          
          alterStatement = `ALTER TABLE submissions ADD COLUMN content_type content_type_enum;`;
          break;
      }
      
      await db.execute(alterStatement);
      console.log(`[Migration] Added column: ${column}`);
    } catch (error) {
      console.error(`[Migration] Error adding column ${column}:`, error);
    }
  }
  
  console.log('[Migration] Column addition completed.');
}

export async function runMigrations() {
  try {
    console.log('[Migration] Starting database migrations...');
    await addMissingColumnsToSubmissions();
    console.log('[Migration] All migrations completed successfully.');
  } catch (error) {
    console.error('[Migration] Error running migrations:', error);
  }
}

// If this file is run directly
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}