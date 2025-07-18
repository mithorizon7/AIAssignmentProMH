/**
 * Production Readiness Validation
 * 
 * Comprehensive check of all systems for production deployment
 */

import http from 'http';
import { execSync } from 'child_process';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          data: data
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function validateProductionReadiness() {
  log('🚀 Production Readiness Validation', 'cyan');
  log('==================================', 'cyan');

  const checks = [];
  
  // 1. Environment Variables
  log('\n📋 Environment Configuration:', 'blue');
  
  const requiredEnvVars = [
    'DATABASE_URL',
    'GEMINI_API_KEY',
    'SESSION_SECRET'
  ];
  
  let envScore = 0;
  requiredEnvVars.forEach(envVar => {
    if (process.env[envVar]) {
      log(`   ✅ ${envVar}: configured`, 'green');
      envScore++;
    } else {
      log(`   ❌ ${envVar}: missing`, 'red');
    }
  });
  
  checks.push({
    name: 'Environment Configuration',
    score: envScore,
    total: requiredEnvVars.length,
    passing: envScore === requiredEnvVars.length
  });

  // 2. Server Health
  log('\n🏥 Server Health Checks:', 'blue');
  
  try {
    const healthResponse = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/health',
      method: 'GET'
    });
    
    if (healthResponse.statusCode === 200) {
      log('   ✅ Health endpoint: operational', 'green');
      checks.push({ name: 'Health Endpoint', passing: true });
    } else {
      log(`   ❌ Health endpoint: status ${healthResponse.statusCode}`, 'red');
      checks.push({ name: 'Health Endpoint', passing: false });
    }
  } catch (error) {
    log(`   ❌ Health endpoint: ${error.message}`, 'red');
    checks.push({ name: 'Health Endpoint', passing: false });
  }

  // 3. Database Connectivity
  log('\n🗄️  Database System:', 'blue');
  
  try {
    const dbResponse = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/system/database-status',
      method: 'GET'
    });
    
    if (dbResponse.statusCode === 200) {
      log('   ✅ Database: connected', 'green');
      checks.push({ name: 'Database', passing: true });
    } else {
      log(`   ❌ Database: status ${dbResponse.statusCode}`, 'red');
      checks.push({ name: 'Database', passing: false });
    }
  } catch (error) {
    log(`   ❌ Database: ${error.message}`, 'red');
    checks.push({ name: 'Database', passing: false });
  }

  // 4. Queue System
  log('\n⚡ Queue System:', 'blue');
  
  try {
    const queueResponse = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/queue/status',
      method: 'GET'
    });
    
    if (queueResponse.statusCode === 200) {
      log('   ✅ Queue system: operational', 'green');
      checks.push({ name: 'Queue System', passing: true });
    } else {
      log(`   ❌ Queue system: status ${queueResponse.statusCode}`, 'red');
      checks.push({ name: 'Queue System', passing: false });
    }
  } catch (error) {
    log(`   ❌ Queue system: ${error.message}`, 'red');
    checks.push({ name: 'Queue System', passing: false });
  }

  // 5. Authentication System
  log('\n🔐 Authentication System:', 'blue');
  
  try {
    const authResponse = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/csrf-token',
      method: 'GET'
    });
    
    if (authResponse.statusCode === 200) {
      log('   ✅ CSRF protection: active', 'green');
      checks.push({ name: 'Authentication', passing: true });
    } else {
      log(`   ❌ CSRF protection: status ${authResponse.statusCode}`, 'red');
      checks.push({ name: 'Authentication', passing: false });
    }
  } catch (error) {
    log(`   ❌ Authentication: ${error.message}`, 'red');
    checks.push({ name: 'Authentication', passing: false });
  }

  // 6. File System Structure
  log('\n📁 File System Structure:', 'blue');
  
  const criticalFiles = [
    'package.json',
    'server/index.ts',
    'client/src/App.tsx',
    'shared/schema.ts',
    'server/db.ts'
  ];
  
  let fileScore = 0;
  criticalFiles.forEach(file => {
    try {
      execSync(`test -f ${file}`, { stdio: 'ignore' });
      log(`   ✅ ${file}: exists`, 'green');
      fileScore++;
    } catch (error) {
      log(`   ❌ ${file}: missing`, 'red');
    }
  });
  
  checks.push({
    name: 'File System',
    score: fileScore,
    total: criticalFiles.length,
    passing: fileScore === criticalFiles.length
  });

  // Summary
  log('\n📊 Production Readiness Summary:', 'cyan');
  log('================================', 'cyan');
  
  const passingChecks = checks.filter(check => check.passing).length;
  const totalChecks = checks.length;
  const successRate = Math.round((passingChecks / totalChecks) * 100);
  
  checks.forEach(check => {
    if (check.score !== undefined) {
      const status = check.passing ? '✅' : '❌';
      log(`   ${status} ${check.name}: ${check.score}/${check.total}`, check.passing ? 'green' : 'red');
    } else {
      const status = check.passing ? '✅' : '❌';
      log(`   ${status} ${check.name}`, check.passing ? 'green' : 'red');
    }
  });
  
  log(`\n📈 Overall Score: ${passingChecks}/${totalChecks} (${successRate}%)`, 'cyan');
  
  if (successRate >= 85) {
    log('\n🎉 PRODUCTION READY! System meets all critical requirements.', 'green');
    return 0;
  } else if (successRate >= 70) {
    log('\n⚠️  MOSTLY READY: Minor issues detected, but deployable.', 'yellow');
    return 0;
  } else {
    log('\n🚨 NOT READY: Critical issues must be resolved before deployment.', 'red');
    return 1;
  }
}

// Run validation
validateProductionReadiness()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    log(`\n💥 Validation failed: ${error.message}`, 'red');
    process.exit(1);
  });