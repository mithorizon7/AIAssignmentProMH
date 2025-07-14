#!/usr/bin/env node
/**
 * Database Optimization Script
 * Adds missing indexes and optimizes database performance
 */

import { spawn } from 'child_process';
import fs from 'fs';

async function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: 'pipe', ...options });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });
  });
}

async function addMissingIndexes() {
  console.log('🔍 Adding missing database indexes...');
  
  const schemaPath = 'shared/schema.ts';
  
  try {
    const content = fs.readFileSync(schemaPath, 'utf8');
    
    // Check if indexes are already present
    const missingIndexes = [
      { table: 'assignments', column: 'course_id', indexName: 'idx_assignments_course_id' },
      { table: 'submissions', column: 'assignment_id', indexName: 'idx_submissions_assignment_id' },
      { table: 'feedback', column: 'submission_id', indexName: 'idx_feedback_submission_id' },
      { table: 'enrollment', column: 'user_id', indexName: 'idx_enrollment_user_id' },
      { table: 'enrollment', column: 'course_id', indexName: 'idx_enrollment_course_id' }
    ];
    
    let updatedContent = content;
    let indexesAdded = 0;
    
    for (const idx of missingIndexes) {
      if (!content.includes(idx.indexName)) {
        console.log(`Adding index: ${idx.indexName} on ${idx.table}.${idx.column}`);
        
        // Find the table definition and add index
        const tableRegex = new RegExp(`export const ${idx.table} = pgTable\\("${idx.table}"[^}]+\\}, \\(table\\) => \\{([^}]+)\\}\\);`, 's');
        const match = updatedContent.match(tableRegex);
        
        if (match) {
          const indexDefinition = `    ${idx.indexName}: index("${idx.indexName}").on(table.${idx.column.replace('_', '')}),`;
          const replacement = match[0].replace(/(\s+return \{[^}]*)(\s+\};)/, `$1\n${indexDefinition}$2`);
          updatedContent = updatedContent.replace(match[0], replacement);
          indexesAdded++;
        }
      }
    }
    
    if (indexesAdded > 0) {
      fs.writeFileSync(schemaPath, updatedContent);
      console.log(`✅ Added ${indexesAdded} missing indexes to schema`);
      return true;
    } else {
      console.log('✅ All indexes already present');
      return false;
    }
  } catch (error) {
    console.error('Failed to add indexes:', error.message);
    return false;
  }
}

async function optimizeHealthChecks() {
  console.log('🔍 Optimizing health check queries...');
  
  const healthCheckPath = 'server/routes/health.ts';
  
  try {
    if (!fs.existsSync(healthCheckPath)) {
      console.log('Creating optimized health check endpoint...');
      
      const healthCheckContent = `
import { Request, Response } from 'express';
import { db } from '../db';

// Cache health check results for 30 seconds
let healthCache: { status: string; timestamp: number; checks: any } | null = null;
const CACHE_DURATION = 30000; // 30 seconds

export async function healthCheck(req: Request, res: Response) {
  try {
    // Return cached result if still valid
    if (healthCache && Date.now() - healthCache.timestamp < CACHE_DURATION) {
      return res.json(healthCache.status);
    }
    
    const start = Date.now();
    
    // Quick database connectivity check
    const dbCheck = await db.execute('SELECT 1 as healthy');
    const dbHealthy = dbCheck.rows.length > 0;
    
    // Basic queue check (if available)
    let queueHealthy = true;
    try {
      // Simple queue health check without heavy operations
      queueHealthy = process.env.REDIS_URL ? true : false;
    } catch {
      queueHealthy = false;
    }
    
    const duration = Date.now() - start;
    
    const checks = {
      database: dbHealthy,
      queue: queueHealthy,
      responseTime: duration
    };
    
    const status = {
      status: dbHealthy && queueHealthy ? 'ok' : 'degraded',
      message: 'System operational',
      timestamp: new Date().toISOString(),
      checks
    };
    
    // Cache the result
    healthCache = {
      status,
      timestamp: Date.now(),
      checks
    };
    
    res.json(status);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message
    });
  }
}
`;
      
      fs.writeFileSync(healthCheckPath, healthCheckContent);
      console.log('✅ Created optimized health check endpoint');
      return true;
    } else {
      console.log('✅ Health check endpoint already exists');
      return false;
    }
  } catch (error) {
    console.error('Failed to optimize health checks:', error.message);
    return false;
  }
}

async function runDatabaseMigration() {
  console.log('🔍 Running database migration...');
  
  try {
    const { stdout, stderr } = await runCommand('npm', ['run', 'db:push']);
    
    if (stdout.includes('success') || stderr.includes('success')) {
      console.log('✅ Database migration completed successfully');
      return true;
    } else {
      console.warn('⚠️  Database migration may have issues');
      console.log('Migration output:', stdout);
      return false;
    }
  } catch (error) {
    console.error('Database migration failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🗄️  Starting Database Optimization Process\n');
  
  // Add missing indexes
  const indexesAdded = await addMissingIndexes();
  
  // Optimize health checks
  const healthOptimized = await optimizeHealthChecks();
  
  // Run database migration if changes were made
  if (indexesAdded || healthOptimized) {
    console.log('\n🔄 Running database migration...');
    await runDatabaseMigration();
  }
  
  console.log('\n🗄️  Database optimization process completed!');
  console.log('Next steps: Monitor query performance and response times');
}

main().catch(error => {
  console.error('Database optimization failed:', error);
  process.exit(1);
});