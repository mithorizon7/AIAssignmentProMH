/**
 * CI/CD Pipeline Validation Script
 * 
 * This script validates that all CI/CD components are properly configured
 * and can run the expected commands successfully.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

class CIValidation {
  constructor() {
    this.results = {
      githubWorkflows: { score: 0, total: 0, details: [] },
      packageScripts: { score: 0, total: 0, details: [] },
      testingSetup: { score: 0, total: 0, details: [] },
      securityConfig: { score: 0, total: 0, details: [] },
      deploymentConfig: { score: 0, total: 0, details: [] }
    };
  }

  async runValidation() {
    console.log('🔍 CI/CD Pipeline Configuration Validation');
    console.log('==========================================\n');
    
    try {
      this.validateGitHubWorkflows();
      this.validatePackageScripts();
      this.validateTestingSetup();
      this.validateSecurityConfig();
      this.validateDeploymentConfig();
      
      this.generateReport();
    } catch (error) {
      console.error('CI/CD validation failed:', error.message);
    }
  }

  validateGitHubWorkflows() {
    console.log('📋 GitHub Workflows Validation');
    
    const expectedWorkflows = [
      { file: '.github/workflows/ci.yml', name: 'CI Pipeline' },
      { file: '.github/workflows/cd.yml', name: 'CD Pipeline' },
      { file: '.github/workflows/security.yml', name: 'Security Scanning' },
      { file: '.github/workflows/dependency-update.yml', name: 'Dependency Updates' }
    ];

    expectedWorkflows.forEach(workflow => {
      this.results.githubWorkflows.total++;
      
      if (fs.existsSync(workflow.file)) {
        const content = fs.readFileSync(workflow.file, 'utf8');
        
        // Basic validation checks
        const hasName = content.includes('name:');
        const hasOnTrigger = content.includes('on:');
        const hasJobs = content.includes('jobs:');
        
        if (hasName && hasOnTrigger && hasJobs) {
          this.results.githubWorkflows.score++;
          this.results.githubWorkflows.details.push(`✅ ${workflow.name}: Valid workflow configuration`);
          console.log(`✅ ${workflow.name}: Valid configuration`);
        } else {
          this.results.githubWorkflows.details.push(`❌ ${workflow.name}: Invalid workflow configuration`);
          console.log(`❌ ${workflow.name}: Invalid configuration`);
        }
      } else {
        this.results.githubWorkflows.details.push(`❌ ${workflow.name}: File not found`);
        console.log(`❌ ${workflow.name}: File not found`);
      }
    });
    
    console.log('');
  }

  validatePackageScripts() {
    console.log('📦 Package Scripts Validation');
    
    const expectedScripts = [
      { script: 'dev', name: 'Development Server' },
      { script: 'build', name: 'Build Script' },
      { script: 'start', name: 'Production Start' },
      { script: 'check', name: 'Type Checking' },
      { script: 'test', name: 'Test Suite', optional: true }
    ];

    let packageJson;
    try {
      packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    } catch (error) {
      console.log('❌ Could not read package.json');
      return;
    }

    const scripts = packageJson.scripts || {};

    expectedScripts.forEach(({ script, name, optional }) => {
      this.results.packageScripts.total++;
      
      if (scripts[script]) {
        this.results.packageScripts.score++;
        this.results.packageScripts.details.push(`✅ ${name}: Available`);
        console.log(`✅ ${name}: ${scripts[script]}`);
        
        // Test if script can run (basic validation)
        try {
          if (script === 'check') {
            execSync('npm run check', { stdio: 'pipe', timeout: 30000 });
            console.log(`   ✅ Type checking passed`);
          }
        } catch (error) {
          console.log(`   ⚠️ Script exists but may have issues: ${error.message.split('\n')[0]}`);
        }
      } else if (optional) {
        console.log(`⚠️ ${name}: Optional script not found`);
      } else {
        this.results.packageScripts.details.push(`❌ ${name}: Missing`);
        console.log(`❌ ${name}: Missing script`);
      }
    });
    
    console.log('');
  }

  validateTestingSetup() {
    console.log('🧪 Testing Setup Validation');
    
    const testingChecks = [
      { path: 'test', name: 'Test Directory' },
      { path: 'vitest.config.ts', name: 'Vitest Configuration' },
      { path: 'test/setup.ts', name: 'Test Setup File' }
    ];

    testingChecks.forEach(check => {
      this.results.testingSetup.total++;
      
      if (fs.existsSync(check.path)) {
        this.results.testingSetup.score++;
        this.results.testingSetup.details.push(`✅ ${check.name}: Found`);
        console.log(`✅ ${check.name}: Found`);
      } else {
        this.results.testingSetup.details.push(`❌ ${check.name}: Not found`);
        console.log(`❌ ${check.name}: Not found`);
      }
    });

    // Check for testing dependencies
    let packageJson;
    try {
      packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const devDeps = packageJson.devDependencies || {};
      
      if (devDeps.vitest) {
        this.results.testingSetup.total++;
        this.results.testingSetup.score++;
        this.results.testingSetup.details.push(`✅ Vitest: Configured`);
        console.log(`✅ Vitest: ${devDeps.vitest}`);
      }
      
      if (devDeps['@testing-library/jest-dom']) {
        console.log(`✅ Testing Library: ${devDeps['@testing-library/jest-dom']}`);
      }
    } catch (error) {
      console.log('⚠️ Could not check testing dependencies');
    }
    
    console.log('');
  }

  validateSecurityConfig() {
    console.log('🔒 Security Configuration Validation');
    
    const securityChecks = [
      { file: '.github/workflows/security.yml', name: 'Security Workflow' },
      { file: '.env.example', name: 'Environment Template' },
      { file: '.gitignore', name: 'Git Ignore Rules' }
    ];

    securityChecks.forEach(check => {
      this.results.securityConfig.total++;
      
      if (fs.existsSync(check.file)) {
        this.results.securityConfig.score++;
        this.results.securityConfig.details.push(`✅ ${check.name}: Configured`);
        console.log(`✅ ${check.name}: Configured`);
        
        // Additional validation for specific files
        if (check.file === '.gitignore') {
          const content = fs.readFileSync(check.file, 'utf8');
          if (content.includes('.env') && content.includes('node_modules')) {
            console.log(`   ✅ Essential patterns included`);
          } else {
            console.log(`   ⚠️ Some essential patterns may be missing`);
          }
        }
      } else {
        this.results.securityConfig.details.push(`❌ ${check.name}: Not configured`);
        console.log(`❌ ${check.name}: Not configured`);
      }
    });
    
    console.log('');
  }

  validateDeploymentConfig() {
    console.log('🚀 Deployment Configuration Validation');
    
    const deploymentChecks = [
      { file: 'Dockerfile', name: 'Docker Configuration' },
      { file: 'docker-compose.yml', name: 'Docker Compose' },
      { file: 'ecosystem.config.js', name: 'PM2 Configuration' },
      { file: 'nginx.conf', name: 'Nginx Configuration' }
    ];

    deploymentChecks.forEach(check => {
      this.results.deploymentConfig.total++;
      
      if (fs.existsSync(check.file)) {
        this.results.deploymentConfig.score++;
        this.results.deploymentConfig.details.push(`✅ ${check.name}: Available`);
        console.log(`✅ ${check.name}: Available`);
      } else {
        this.results.deploymentConfig.details.push(`⚠️ ${check.name}: Not found (optional)`);
        console.log(`⚠️ ${check.name}: Not found (optional)`);
      }
    });
    
    console.log('');
  }

  generateReport() {
    console.log('📊 CI/CD VALIDATION REPORT');
    console.log('==========================');
    
    const categories = [
      { name: 'GitHub Workflows', results: this.results.githubWorkflows },
      { name: 'Package Scripts', results: this.results.packageScripts },
      { name: 'Testing Setup', results: this.results.testingSetup },
      { name: 'Security Config', results: this.results.securityConfig },
      { name: 'Deployment Config', results: this.results.deploymentConfig }
    ];

    let totalScore = 0;
    let totalTests = 0;

    categories.forEach(category => {
      const percentage = category.results.total > 0 
        ? Math.round((category.results.score / category.results.total) * 100)
        : 0;
      
      console.log(`\n${category.name}: ${category.results.score}/${category.results.total} (${percentage}%)`);
      
      totalScore += category.results.score;
      totalTests += category.results.total;
    });

    const overallPercentage = totalTests > 0 ? Math.round((totalScore / totalTests) * 100) : 0;
    
    console.log(`\n🎯 OVERALL CI/CD READINESS: ${totalScore}/${totalTests} (${overallPercentage}%)`);
    
    if (overallPercentage >= 90) {
      console.log('\n🎉 EXCELLENT - CI/CD pipeline is production-ready');
      console.log('✅ All essential components configured');
      console.log('✅ Ready for automated testing and deployment');
    } else if (overallPercentage >= 75) {
      console.log('\n✅ GOOD - CI/CD pipeline is functional with minor gaps');
      console.log('⚠️ Review missing components above');
    } else if (overallPercentage >= 60) {
      console.log('\n⚠️ FAIR - CI/CD pipeline needs improvement');
      console.log('❌ Address critical missing components');
    } else {
      console.log('\n❌ POOR - CI/CD pipeline requires significant work');
      console.log('❌ Many essential components missing');
    }

    console.log('\n🔧 RECOMMENDED ACTIONS:');
    if (this.results.githubWorkflows.score < this.results.githubWorkflows.total) {
      console.log('- Complete GitHub workflow configuration');
    }
    if (this.results.packageScripts.score < this.results.packageScripts.total) {
      console.log('- Add missing package.json scripts');
    }
    if (this.results.testingSetup.score < this.results.testingSetup.total) {
      console.log('- Set up comprehensive testing framework');
    }
    if (this.results.securityConfig.score < this.results.securityConfig.total) {
      console.log('- Configure security scanning and protections');
    }

    console.log('\n🚀 NEXT STEPS:');
    console.log('1. Commit CI/CD configuration to repository');
    console.log('2. Test workflows with a sample PR');
    console.log('3. Configure deployment environments');
    console.log('4. Set up monitoring and alerting');
    console.log('5. Train team on CI/CD processes');
  }
}

// Run the CI/CD validation
const validator = new CIValidation();
validator.runValidation().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('CI/CD validation failed:', error);
  process.exit(1);
});