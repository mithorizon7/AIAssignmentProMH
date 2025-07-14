#!/usr/bin/env node
/**
 * Production Readiness Validator
 * Comprehensive system validation for production deployment
 */

import { validateProductionReadiness } from '../server/lib/production-validator.js';

async function runValidation() {
  console.log('🔍 Starting production readiness validation...\n');
  
  try {
    const result = await validateProductionReadiness();
    
    if (result.isValid) {
      console.log('✅ Production readiness validation PASSED\n');
      
      if (result.warnings.length > 0) {
        console.log('⚠️  Warnings:');
        result.warnings.forEach(warning => console.log(`  - ${warning}`));
        console.log();
      }
      
      console.log('🎯 System Status:');
      console.log(`  - Environment: ${result.checks.environment ? '✅' : '❌'}`);
      console.log(`  - Database: ${result.checks.database ? '✅' : '❌'}`);
      console.log(`  - Redis: ${result.checks.redis ? '✅' : '❌'}`);
      console.log(`  - Security: ${result.checks.security ? '✅' : '❌'}`);
      console.log(`  - API Keys: ${result.checks.apiKeys ? '✅' : '❌'}`);
      console.log(`  - Storage: ${result.checks.storage ? '✅' : '❌'}`);
      
      console.log('\n🚀 System is ready for production deployment!');
      process.exit(0);
    } else {
      console.log('❌ Production readiness validation FAILED\n');
      
      console.log('🚨 Critical Issues:');
      result.errors.forEach(error => console.log(`  - ${error}`));
      
      if (result.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        result.warnings.forEach(warning => console.log(`  - ${warning}`));
      }
      
      console.log('\n🔧 Please fix these issues before deploying to production.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Validation failed with error:', error);
    process.exit(1);
  }
}

runValidation();