#!/usr/bin/env node
/**
 * Security Vulnerability Fix Script
 * Addresses critical security issues for production deployment
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

async function checkVulnerabilities() {
  console.log('🔍 Checking current security vulnerabilities...');
  
  try {
    const { stdout } = await runCommand('npm', ['audit', '--json']);
    const audit = JSON.parse(stdout);
    
    console.log(`Found ${audit.metadata.vulnerabilities.total} total vulnerabilities:`);
    console.log(`- Critical: ${audit.metadata.vulnerabilities.critical}`);
    console.log(`- High: ${audit.metadata.vulnerabilities.high}`);
    console.log(`- Moderate: ${audit.metadata.vulnerabilities.moderate}`);
    console.log(`- Low: ${audit.metadata.vulnerabilities.low}`);
    
    return audit;
  } catch (error) {
    console.error('Failed to check vulnerabilities:', error.message);
    return null;
  }
}

async function fixVulnerabilities() {
  console.log('🔧 Attempting to fix security vulnerabilities...');
  
  try {
    // Try automated fix first
    await runCommand('npm', ['audit', 'fix', '--force']);
    console.log('✅ Automated vulnerability fixes applied');
    
    // Update specific problematic packages
    const packagesToUpdate = [
      'esbuild@latest',
      'quill@2.0.2',
      'react-quill@2.0.0'
    ];
    
    for (const pkg of packagesToUpdate) {
      try {
        console.log(`Updating ${pkg}...`);
        await runCommand('npm', ['install', pkg]);
        console.log(`✅ Updated ${pkg}`);
      } catch (error) {
        console.warn(`⚠️  Failed to update ${pkg}: ${error.message}`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Failed to fix vulnerabilities:', error.message);
    return false;
  }
}

async function validateSecurityHeaders() {
  console.log('🔍 Validating security headers configuration...');
  
  const serverIndexPath = 'server/index.ts';
  
  try {
    const content = fs.readFileSync(serverIndexPath, 'utf8');
    
    const securityChecks = [
      { name: 'Helmet middleware', pattern: /helmet\(\)/ },
      { name: 'CORS configuration', pattern: /cors\(/ },
      { name: 'Rate limiting', pattern: /rateLimit/ },
      { name: 'CSRF protection', pattern: /csrf/ }
    ];
    
    securityChecks.forEach(check => {
      if (check.pattern.test(content)) {
        console.log(`✅ ${check.name} configured`);
      } else {
        console.warn(`⚠️  ${check.name} not found`);
      }
    });
    
    return true;
  } catch (error) {
    console.error('Failed to validate security headers:', error.message);
    return false;
  }
}

async function main() {
  console.log('🛡️  Starting Security Vulnerability Fix Process\n');
  
  // Check initial state
  const initialAudit = await checkVulnerabilities();
  
  // Fix vulnerabilities
  const fixSuccess = await fixVulnerabilities();
  
  if (fixSuccess) {
    console.log('\n🔍 Rechecking vulnerabilities after fixes...');
    const finalAudit = await checkVulnerabilities();
    
    if (finalAudit && initialAudit) {
      const improvement = initialAudit.metadata.vulnerabilities.total - finalAudit.metadata.vulnerabilities.total;
      console.log(`\n📊 Security improvement: ${improvement} vulnerabilities fixed`);
    }
  }
  
  // Validate security configuration
  await validateSecurityHeaders();
  
  console.log('\n🛡️  Security vulnerability fix process completed!');
  console.log('Next steps: Run npm audit to verify remaining issues');
}

main().catch(error => {
  console.error('Security fix process failed:', error);
  process.exit(1);
});