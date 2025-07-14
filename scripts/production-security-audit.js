#!/usr/bin/env node
/**
 * Production Security Audit Script
 * Comprehensive security validation for production deployment
 */

import { spawn } from 'child_process';
import fs from 'fs';
import { performance } from 'perf_hooks';

async function runCommand(command, args, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: 'pipe' });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    proc.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
    
    // Timeout handling
    setTimeout(() => {
      proc.kill();
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);
  });
}

async function auditDependencies() {
  console.log('🔍 Auditing dependencies for security vulnerabilities...');
  
  try {
    const { code, stdout, stderr } = await runCommand('npm', ['audit', '--json']);
    
    if (code !== 0 && !stdout.includes('vulnerabilities')) {
      console.error('Audit failed:', stderr);
      return { success: false, vulnerabilities: null };
    }
    
    const audit = JSON.parse(stdout);
    const vulns = audit.metadata?.vulnerabilities || {};
    
    console.log(`Found ${vulns.total || 0} total vulnerabilities:`);
    console.log(`- Critical: ${vulns.critical || 0}`);
    console.log(`- High: ${vulns.high || 0}`);
    console.log(`- Moderate: ${vulns.moderate || 0}`);
    console.log(`- Low: ${vulns.low || 0}`);
    
    return { 
      success: true, 
      vulnerabilities: vulns,
      critical: vulns.critical || 0,
      high: vulns.high || 0,
      moderate: vulns.moderate || 0,
      low: vulns.low || 0,
      total: vulns.total || 0
    };
  } catch (error) {
    console.error('Dependency audit failed:', error.message);
    return { success: false, vulnerabilities: null };
  }
}

async function validateSecurityHeaders() {
  console.log('🔍 Validating security headers configuration...');
  
  const serverIndexPath = 'server/index.ts';
  
  try {
    const content = fs.readFileSync(serverIndexPath, 'utf8');
    
    const securityChecks = [
      { name: 'Helmet middleware', pattern: /helmet\(/, required: true },
      { name: 'CSP configuration', pattern: /contentSecurityPolicy/, required: true },
      { name: 'HSTS configuration', pattern: /strictTransportSecurity/, required: true },
      { name: 'Express security', pattern: /express\.json.*limit/, required: true },
      { name: 'Security monitoring', pattern: /securityMonitoringMiddleware/, required: true }
    ];
    
    let passed = 0;
    let failed = 0;
    
    securityChecks.forEach(check => {
      if (check.pattern.test(content)) {
        console.log(`✅ ${check.name} configured`);
        passed++;
      } else {
        console.log(`${check.required ? '❌' : '⚠️'} ${check.name} ${check.required ? 'MISSING' : 'not found'}`);
        if (check.required) failed++;
      }
    });
    
    return { passed, failed, total: securityChecks.length };
  } catch (error) {
    console.error('Security header validation failed:', error.message);
    return { passed: 0, failed: 99, total: 0 };
  }
}

async function testPerformance() {
  console.log('🔍 Testing application performance...');
  
  try {
    const start = performance.now();
    const response = await fetch('http://localhost:5000/api/health');
    const end = performance.now();
    
    const duration = end - start;
    const isHealthy = response.ok;
    
    console.log(`Health endpoint: ${duration.toFixed(2)}ms (${isHealthy ? 'OK' : 'FAIL'})`);
    
    return {
      healthEndpointTime: duration,
      healthEndpointStatus: isHealthy,
      performanceGrade: duration < 200 ? 'A' : duration < 500 ? 'B' : duration < 1000 ? 'C' : 'F'
    };
  } catch (error) {
    console.error('Performance test failed:', error.message);
    return {
      healthEndpointTime: 9999,
      healthEndpointStatus: false,
      performanceGrade: 'F'
    };
  }
}

async function checkProductionReadiness() {
  console.log('🔍 Checking production readiness...');
  
  const checks = [
    { name: 'Environment variables', check: () => process.env.DATABASE_URL },
    { name: 'Database connection', check: () => process.env.DATABASE_URL?.includes('postgres') },
    { name: 'Redis connection', check: () => process.env.REDIS_URL || process.env.REDIS_HOST },
    { name: 'AI API keys', check: () => process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY },
    { name: 'Session secrets', check: () => process.env.SESSION_SECRET && process.env.CSRF_SECRET }
  ];
  
  let passed = 0;
  let failed = 0;
  
  checks.forEach(check => {
    if (check.check()) {
      console.log(`✅ ${check.name} configured`);
      passed++;
    } else {
      console.log(`❌ ${check.name} missing`);
      failed++;
    }
  });
  
  return { passed, failed, total: checks.length };
}

async function main() {
  console.log('🛡️  Starting Production Security Audit\n');
  
  const results = {};
  
  // Run all security checks
  results.dependencies = await auditDependencies();
  results.headers = await validateSecurityHeaders();
  results.performance = await testPerformance();
  results.readiness = await checkProductionReadiness();
  
  // Generate final report
  console.log('\n📊 Security Audit Report');
  console.log('=' .repeat(50));
  
  // Dependencies
  const deps = results.dependencies;
  if (deps.success) {
    const status = deps.critical + deps.high === 0 ? '✅ PASS' : '❌ FAIL';
    console.log(`Dependencies: ${status} (${deps.total} total vulnerabilities)`);
  } else {
    console.log('Dependencies: ❌ AUDIT FAILED');
  }
  
  // Security headers
  const headers = results.headers;
  const headerStatus = headers.failed === 0 ? '✅ PASS' : '❌ FAIL';
  console.log(`Security Headers: ${headerStatus} (${headers.passed}/${headers.total})`);
  
  // Performance
  const perf = results.performance;
  const perfStatus = perf.performanceGrade === 'A' || perf.performanceGrade === 'B' ? '✅ PASS' : '❌ FAIL';
  console.log(`Performance: ${perfStatus} (Grade: ${perf.performanceGrade})`);
  
  // Production readiness
  const readiness = results.readiness;
  const readinessStatus = readiness.failed === 0 ? '✅ PASS' : '❌ FAIL';
  console.log(`Production Config: ${readinessStatus} (${readiness.passed}/${readiness.total})`);
  
  // Overall assessment
  const overallPass = (
    (deps.success && deps.critical + deps.high === 0) &&
    (headers.failed === 0) &&
    (perf.performanceGrade === 'A' || perf.performanceGrade === 'B') &&
    (readiness.failed === 0)
  );
  
  console.log('\n🎯 Final Assessment');
  console.log(`Production Ready: ${overallPass ? '✅ YES' : '❌ NO'}`);
  
  if (!overallPass) {
    console.log('\n⚠️  Action Required:');
    if (deps.success && (deps.critical + deps.high > 0)) {
      console.log('- Fix critical/high security vulnerabilities');
    }
    if (headers.failed > 0) {
      console.log('- Configure missing security headers');
    }
    if (perf.performanceGrade === 'C' || perf.performanceGrade === 'F') {
      console.log('- Improve application performance');
    }
    if (readiness.failed > 0) {
      console.log('- Configure missing production environment variables');
    }
  }
  
  console.log('\n🛡️  Security audit completed!');
  
  // Exit with appropriate code
  process.exit(overallPass ? 0 : 1);
}

main().catch(error => {
  console.error('Security audit failed:', error);
  process.exit(1);
});