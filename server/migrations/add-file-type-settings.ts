/**
 * Migration to create the file_type_settings table and add default settings
 */
import { pool, db } from '../db';
import { fileTypeSettings, contentTypeEnum } from '../../shared/schema';
import { eq } from 'drizzle-orm';

export async function createFileTypeSettingsTable() {
  console.log('[Migration] Creating file_type_settings table and adding default settings...');
  
  try {
    // Check if the file_type_settings table exists
    const checkTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'file_type_settings'
      );
    `;
    
    const tableResult = await db.execute(checkTableQuery);
    const tableExists = tableResult.rows[0]?.exists;
    
    if (!tableExists) {
      // Create the content_type enum if it doesn't exist
      try {
        await db.execute(`
          CREATE TYPE content_type AS ENUM ('text', 'image', 'audio', 'video', 'document');
        `);
        console.log('[Migration] Created content_type enum');
      } catch (error) {
        // Enum might already exist, which is fine
        console.log('[Migration] content_type enum already exists or error creating it:', 
          error instanceof Error ? error.message : String(error));
      }
      
      // Create the file_type_settings table
      await db.execute(`
        CREATE TABLE file_type_settings (
          id SERIAL PRIMARY KEY,
          context TEXT NOT NULL,
          context_id INTEGER,
          content_type content_type NOT NULL,
          enabled BOOLEAN NOT NULL DEFAULT false,
          extensions JSONB NOT NULL,
          mime_types JSONB NOT NULL,
          max_size INTEGER NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_by INTEGER REFERENCES users(id)
        );
        
        CREATE INDEX idx_file_type_settings_context_type ON file_type_settings(context, content_type);
        CREATE INDEX idx_file_type_settings_context_id_type ON file_type_settings(context_id, content_type);
      `);
      
      console.log('[Migration] Created file_type_settings table');
      
      // Insert default text file type settings
      await db.insert(fileTypeSettings).values({
        context: 'system',
        contentType: 'text',
        enabled: true,
        extensions: ['txt', 'md', 'js', 'ts', 'py', 'java', 'c', 'cpp', 'h', 'cs', 'html', 'css', 'json', 'xml', 'yaml', 'sql'],
        mimeTypes: ['text/plain', 'text/markdown', 'text/javascript', 'text/typescript', 'text/x-python', 'text/x-java', 'text/x-c', 'text/html', 'text/css', 'application/json', 'text/xml', 'text/yaml', 'text/x-sql'],
        maxSize: 5 * 1024 * 1024 // 5MB
      });
      
      // Insert default image file type settings
      await db.insert(fileTypeSettings).values({
        context: 'system',
        contentType: 'image',
        enabled: true,
        extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
        mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
        maxSize: 10 * 1024 * 1024 // 10MB
      });
      
      // Insert default document file type settings
      await db.insert(fileTypeSettings).values({
        context: 'system',
        contentType: 'document',
        enabled: true,
        extensions: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'csv'],
        mimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'],
        maxSize: 20 * 1024 * 1024 // 20MB
      });
      
      // Insert default audio file type settings
      await db.insert(fileTypeSettings).values({
        context: 'system',
        contentType: 'audio',
        enabled: true,
        extensions: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'],
        mimeTypes: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac', 'audio/mp4'],
        maxSize: 50 * 1024 * 1024 // 50MB
      });
      
      // Insert default video file type settings
      await db.insert(fileTypeSettings).values({
        context: 'system',
        contentType: 'video',
        enabled: true,
        extensions: ['mp4', 'webm', 'ogv', 'avi', 'mov', 'wmv'],
        mimeTypes: ['video/mp4', 'video/webm', 'video/ogg', 'video/x-msvideo', 'video/quicktime', 'video/x-ms-wmv'],
        maxSize: 100 * 1024 * 1024 // 100MB
      });
      
      console.log('[Migration] Added default file type settings');
    } else {
      console.log('[Migration] file_type_settings table already exists');
    }
    
    return true;
  } catch (error) {
    console.error('[Migration] Error creating file_type_settings table:', 
      error instanceof Error ? error.message : String(error));
    return false;
  }
}