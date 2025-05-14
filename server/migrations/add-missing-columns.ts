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
          // Check if the column already exists
          const mimeTypeColumnQuery = `
            SELECT data_type
            FROM information_schema.columns 
            WHERE table_name = 'submissions' AND column_name = 'mime_type';
          `;
          const mimeTypeColumnResult = await db.execute(mimeTypeColumnQuery);
          const mimeTypeColumnExists = mimeTypeColumnResult.rows.length > 0;
          
          if (mimeTypeColumnExists) {
            console.log('[Migration] Column mime_type already exists with type:', mimeTypeColumnResult.rows[0].data_type);
            // Skip this column since it already exists
            continue;
          }
          
          alterStatement = `ALTER TABLE submissions ADD COLUMN mime_type TEXT;`;
          break;
        case 'file_size':
          // Check if the column already exists
          const fileSizeColumnQuery = `
            SELECT data_type
            FROM information_schema.columns 
            WHERE table_name = 'submissions' AND column_name = 'file_size';
          `;
          const fileSizeColumnResult = await db.execute(fileSizeColumnQuery);
          const fileSizeColumnExists = fileSizeColumnResult.rows.length > 0;
          
          if (fileSizeColumnExists) {
            console.log('[Migration] Column file_size already exists with type:', fileSizeColumnResult.rows[0].data_type);
            // Skip this column since it already exists
            continue;
          }
          
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
          
          // Check if the column already exists and get its type
          const columnTypeQuery = `
            SELECT data_type, udt_name 
            FROM information_schema.columns 
            WHERE table_name = 'submissions' AND column_name = 'content_type';
          `;
          const columnTypeResult = await db.execute(columnTypeQuery);
          const columnExists = columnTypeResult.rows.length > 0;
          
          if (columnExists) {
            // Column already exists, check if it's the right type
            const dataType = columnTypeResult.rows[0].data_type;
            const udtName = columnTypeResult.rows[0].udt_name;
            
            console.log(`[Migration] Column content_type already exists with type: ${dataType} (${udtName})`);
            
            if (dataType === 'USER-DEFINED' && udtName === 'content_type_enum') {
              console.log('[Migration] Column content_type already has correct enum type.');
              // Skip this column since it's already the right type
              continue;
            } else {
              // Handle column type migration (preserving data if possible)
              console.log('[Migration] Column content_type exists but has wrong type. Performing migration...');
              
              // Create the enum type if needed
              if (!enumExists) {
                await db.execute(`
                  CREATE TYPE content_type_enum AS ENUM ('text', 'image', 'audio', 'video', 'document');
                `);
                console.log('[Migration] Created content_type_enum type.');
              }
              
              // Rename existing column
              await db.execute(`
                ALTER TABLE submissions RENAME COLUMN content_type TO content_type_old;
              `);
              console.log('[Migration] Renamed content_type to content_type_old.');
              
              // Add new column with correct type
              await db.execute(`
                ALTER TABLE submissions ADD COLUMN content_type content_type_enum;
              `);
              console.log('[Migration] Added content_type column with enum type.');
              
              // Migrate data (with basic type conversion)
              try {
                // Convert existing data to the new enum (with some basic mapping)
                await db.execute(`
                  UPDATE submissions
                  SET content_type = CASE
                    WHEN content_type_old LIKE '%text%' THEN 'text'::content_type_enum
                    WHEN content_type_old LIKE '%image%' THEN 'image'::content_type_enum
                    WHEN content_type_old LIKE '%audio%' THEN 'audio'::content_type_enum
                    WHEN content_type_old LIKE '%video%' THEN 'video'::content_type_enum
                    WHEN content_type_old LIKE '%document%' THEN 'document'::content_type_enum
                    ELSE 'text'::content_type_enum
                  END;
                `);
                console.log('[Migration] Migrated data from content_type_old to content_type.');
              } catch (error) {
                console.error('[Migration] Error migrating data:', error);
                console.log('[Migration] Continuing with migration, but data may be lost.');
              }
              
              // Skip the default ALTER TABLE statement since we've already handled it
              continue;
            }
          }
          
          // If we reach here, the column doesn't exist and needs to be created
          
          // Create the enum type if needed
          if (!enumExists) {
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
    
    // Import the createFileTypeSettingsTable function dynamically to avoid circular dependencies
    const { createFileTypeSettingsTable } = await import('./add-file-type-settings');
    await createFileTypeSettingsTable();
    
    console.log('[Migration] All migrations completed successfully.');
  } catch (error) {
    console.error('[Migration] Error running migrations:', error);
  }
}

// We don't need to run this file directly in this case
// as it will be imported by the server during startup
// Just export the runMigrations function for use in server/index.ts