#!/usr/bin/env node
/**
 * Production Security Script: Remove Debug Logging
 * Removes console.log statements from production code
 */

import fs from 'fs';
import path from 'path';

const serverFiles = [
  'server/services/batch-operations.ts',
  'server/services/lms/blackboard-service.ts',
  'server/services/lms/canvas-service.ts',
  'server/services/ai-service.ts',
  'server/auth.ts'
];

function removeDebugLogging(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const originalLines = content.split('\n').length;
    
    // Replace console.log, console.error, console.warn with logger calls
    let cleaned = content
      .replace(/console\.log\(/g, 'logger.info(')
      .replace(/console\.error\(/g, 'logger.error(')
      .replace(/console\.warn\(/g, 'logger.warn(')
      .replace(/console\.debug\(/g, 'logger.debug(');
    
    // Ensure logger is imported
    if (cleaned.includes('logger.') && !cleaned.includes('import { logger }')) {
      const importMatch = cleaned.match(/^import.*from.*$/m);
      if (importMatch) {
        cleaned = cleaned.replace(importMatch[0], 
          `${importMatch[0]}\nimport { logger } from '../lib/error-handler';`);
      }
    }
    
    const newLines = cleaned.split('\n').length;
    
    if (content !== cleaned) {
      fs.writeFileSync(filePath, cleaned);
      console.log(`✅ Fixed ${filePath} (${originalLines} → ${newLines} lines)`);
    } else {
      console.log(`✓ ${filePath} - No changes needed`);
    }
    
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
}

console.log('🔧 Removing debug logging from production code...\n');

serverFiles.forEach(file => {
  if (fs.existsSync(file)) {
    removeDebugLogging(file);
  } else {
    console.log(`⚠️  File not found: ${file}`);
  }
});

console.log('\n✅ Debug logging cleanup completed!');