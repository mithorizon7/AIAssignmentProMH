/**
 * Database Migration: Add LMS Integration Tables
 * 
 * This script creates the necessary tables for LMS integration:
 * - lms_credentials
 * - lms_sync_jobs
 * - lms_course_mappings
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

export async function addLmsTables() {
  console.log('Starting migration: Adding LMS integration tables...');
  
  try {
    // Create lms_provider enum if it doesn't exist
    try {
      await db.execute(sql`
        CREATE TYPE "lms_provider" AS ENUM ('canvas', 'blackboard', 'moodle', 'd2l');
      `);
      console.log('Created lms_provider enum');
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        console.log('lms_provider enum already exists, skipping...');
      } else {
        throw error;
      }
    }
    
    // Create sync_status enum if it doesn't exist
    try {
      await db.execute(sql`
        CREATE TYPE "sync_status" AS ENUM ('pending', 'in_progress', 'completed', 'failed');
      `);
      console.log('Created sync_status enum');
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        console.log('sync_status enum already exists, skipping...');
      } else {
        throw error;
      }
    }
    
    // Create lms_credentials table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS "lms_credentials" (
        "id" SERIAL PRIMARY KEY,
        "provider" "lms_provider" NOT NULL,
        "name" TEXT NOT NULL,
        "base_url" TEXT NOT NULL,
        "client_id" TEXT NOT NULL,
        "client_secret" TEXT NOT NULL,
        "callback_url" TEXT NOT NULL,
        "active" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "created_by" INTEGER REFERENCES "users"("id")
      );
      
      CREATE INDEX IF NOT EXISTS "idx_lms_credentials_provider" ON "lms_credentials"("provider");
      CREATE INDEX IF NOT EXISTS "idx_lms_credentials_active" ON "lms_credentials"("active");
    `);
    console.log('Created lms_credentials table');
    
    // Create lms_sync_jobs table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "lms_sync_jobs" (
        "id" SERIAL PRIMARY KEY,
        "credential_id" INTEGER NOT NULL REFERENCES "lms_credentials"("id"),
        "sync_type" TEXT NOT NULL,
        "status" "sync_status" NOT NULL DEFAULT 'pending',
        "started_at" TIMESTAMP,
        "completed_at" TIMESTAMP,
        "error_message" TEXT,
        "sync_data" JSONB,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "created_by" INTEGER REFERENCES "users"("id")
      );
      
      CREATE INDEX "idx_lms_sync_jobs_credential_id" ON "lms_sync_jobs"("credential_id");
      CREATE INDEX "idx_lms_sync_jobs_status" ON "lms_sync_jobs"("status");
      CREATE INDEX "idx_lms_sync_jobs_sync_type" ON "lms_sync_jobs"("sync_type");
      CREATE INDEX "idx_lms_sync_jobs_created_at" ON "lms_sync_jobs"("created_at");
    `);
    console.log('Created lms_sync_jobs table');
    
    // Create lms_course_mappings table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "lms_course_mappings" (
        "id" SERIAL PRIMARY KEY,
        "course_id" INTEGER NOT NULL REFERENCES "courses"("id"),
        "credential_id" INTEGER NOT NULL REFERENCES "lms_credentials"("id"),
        "lms_course_id" TEXT NOT NULL,
        "lms_course_name" TEXT,
        "last_synced" TIMESTAMP,
        "sync_enabled" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX "idx_lms_course_mappings_course_id" ON "lms_course_mappings"("course_id");
      CREATE INDEX "idx_lms_course_mappings_credential_id" ON "lms_course_mappings"("credential_id");
      CREATE INDEX "idx_lms_course_mappings_course_credential" ON "lms_course_mappings"("course_id", "credential_id");
      CREATE INDEX "idx_lms_course_mappings_lms_course_id" ON "lms_course_mappings"("lms_course_id");
    `);
    console.log('Created lms_course_mappings table');
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    
    // Check if it's a duplicate enum error and continue
    if (error instanceof Error && error.message.includes('already exists')) {
      console.log('Some objects already exist. This is OK for reruns.');
    } else {
      throw error;
    }
  }
}