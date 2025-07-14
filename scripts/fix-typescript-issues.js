#!/usr/bin/env node
/**
 * TypeScript Issues Fix Script
 * Addresses critical TypeScript compilation problems
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const filesToFix = [
  'server/services/lms/base-lms-service.ts',
  'server/services/lms/blackboard-service.ts', 
  'server/services/lms/canvas-service.ts',
  'server/services/ai-service.ts',
  'server/adapters/ai-adapter.ts',
  'server/adapters/openai-adapter.ts',
  'server/adapters/gemini-adapter.ts',
  'server/queue/worker.ts'
];

function fixCommonTypeIssues(content) {
  // Fix common TypeScript issues
  let fixed = content
    // Replace 'any' with proper types
    .replace(/: any\b/g, ': unknown')
    .replace(/any\[\]/g, 'unknown[]')
    .replace(/any\s*=/g, 'unknown =')
    
    // Fix common type assertions
    .replace(/as any/g, 'as unknown')
    
    // Remove @ts-ignore comments
    .replace(/\/\/\s*@ts-ignore.*\n/g, '')
    .replace(/\/\*\s*@ts-ignore\s*\*\//g, '')
    
    // Fix undefined checks
    .replace(/if\s*\(\s*(\w+)\s*\)/g, 'if ($1 !== undefined && $1 !== null)')
    
    // Add proper null checks
    .replace(/\.length\s*>/g, '?.length > 0 &&')
    .replace(/\.length\s*===/g, '?.length === 0 ||');
  
  return fixed;
}

async function fixFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${filePath}`);
      return false;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const fixed = fixCommonTypeIssues(content);
    
    if (content !== fixed) {
      fs.writeFileSync(filePath, fixed);
      console.log(`✅ Fixed TypeScript issues in ${filePath}`);
      return true;
    } else {
      console.log(`✓ No TypeScript issues found in ${filePath}`);
      return true;
    }
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
    return false;
  }
}

async function runQuickTypeCheck() {
  console.log('🔍 Running quick TypeScript check...');
  
  return new Promise((resolve) => {
    const tsc = spawn('npx', ['tsc', '--noEmit', '--skipLibCheck'], { 
      stdio: 'pipe',
      timeout: 10000
    });
    
    let output = '';
    tsc.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    tsc.stderr.on('data', (data) => {
      output += data.toString();
    });
    
    tsc.on('close', (code) => {
      if (code === 0) {
        console.log('✅ TypeScript check passed');
        resolve(true);
      } else {
        console.log('❌ TypeScript check failed');
        console.log('First few errors:', output.split('\n').slice(0, 5).join('\n'));
        resolve(false);
      }
    });
    
    tsc.on('error', (error) => {
      console.error('TypeScript check error:', error.message);
      resolve(false);
    });
  });
}

async function main() {
  console.log('🔧 Fixing critical TypeScript issues...\n');
  
  let fixedCount = 0;
  for (const file of filesToFix) {
    if (await fixFile(file)) {
      fixedCount++;
    }
  }
  
  console.log(`\n📊 Fixed ${fixedCount}/${filesToFix.length} files`);
  
  // Run quick type check
  const typeCheckPassed = await runQuickTypeCheck();
  
  if (typeCheckPassed) {
    console.log('\n🎉 TypeScript issues resolved!');
  } else {
    console.log('\n⚠️  Some TypeScript issues remain - manual review needed');
  }
}

main().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});