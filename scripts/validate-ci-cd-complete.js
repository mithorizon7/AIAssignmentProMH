/**
 * Comprehensive CI/CD validation script to ensure everything is working correctly
 * Tests all configurations, workflows, and dependencies
 */

import fs from 'fs';
import { execSync } from 'child_process';

class CICDValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.passed = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : '✅';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  addResult(message, isError = false, isWarning = false) {
    if (isError) {
      this.errors.push(message);
      this.log(message, 'error');
    } else if (isWarning) {
      this.warnings.push(message);
      this.log(message, 'warning');
    } else {
      this.passed.push(message);
      this.log(message, 'info');
    }
  }

  validateFileExists(filePath, description) {
    if (fs.existsSync(filePath)) {
      this.addResult(`${description}: Found at ${filePath}`);
      return true;
    } else {
      this.addResult(`${description}: Missing at ${filePath}`, true);
      return false;
    }
  }

  validateCommand(command, description) {
    try {
      execSync(command, { stdio: 'pipe' });
      this.addResult(`${description}: Command executed successfully`);
      return true;
    } catch (error) {
      this.addResult(`${description}: Command failed - ${error.message}`, true);
      return false;
    }
  }

  validateWorkflows() {
    console.log('\n🔄 Validating GitHub Actions Workflows...\n');

    const requiredWorkflows = [
      { file: '.github/workflows/ci.yml', name: 'CI Pipeline' },
      { file: '.github/workflows/cd.yml', name: 'CD Pipeline' },
      { file: '.github/workflows/security.yml', name: 'Security Scanning' },
      { file: '.github/workflows/quality-gate.yml', name: 'Quality Gate' },
      { file: '.github/workflows/dependency-update.yml', name: 'Dependency Updates' },
      { file: '.github/workflows/performance-monitoring.yml', name: 'Performance Monitoring' }
    ];

    requiredWorkflows.forEach(workflow => {
      if (this.validateFileExists(workflow.file, `${workflow.name} workflow`)) {
        // Validate workflow syntax
        try {
          const content = fs.readFileSync(workflow.file, 'utf8');
          
          // Basic YAML validation
          if (!content.includes('name:')) {
            this.addResult(`${workflow.name}: Missing 'name' field`, true);
          }
          if (!content.includes('on:')) {
            this.addResult(`${workflow.name}: Missing 'on' triggers`, true);
          }
          if (!content.includes('jobs:')) {
            this.addResult(`${workflow.name}: Missing 'jobs' section`, true);
          }
          
          // Check for best practices
          if (content.includes('actions/checkout@v4')) {
            this.addResult(`${workflow.name}: Uses latest checkout action`);
          } else if (content.includes('actions/checkout@')) {
            this.addResult(`${workflow.name}: Uses older checkout action`, false, true);
          }

          if (content.includes('setup-node@v4')) {
            this.addResult(`${workflow.name}: Uses latest Node.js setup action`);
          }

        } catch (error) {
          this.addResult(`${workflow.name}: Failed to read workflow file`, true);
        }
      }
    });
  }

  validateCodeQuality() {
    console.log('\n📝 Validating Code Quality Tools...\n');

    // ESLint validation
    if (this.validateFileExists('.eslintrc.js', 'ESLint legacy config') || 
        this.validateFileExists('eslint.config.js', 'ESLint flat config')) {
      
      // Test ESLint command
      try {
        execSync('npx eslint --version', { stdio: 'pipe' });
        this.addResult('ESLint: Version check passed');
        
        // Test with a simple file
        execSync('echo "const test = 1;" | npx eslint --stdin --stdin-filename test.js', { stdio: 'pipe' });
        this.addResult('ESLint: Basic linting test passed');
      } catch (error) {
        this.addResult('ESLint: Command execution failed', true);
      }
    }

    // Prettier validation
    if (this.validateFileExists('.prettierrc', 'Prettier config')) {
      try {
        execSync('npx prettier --version', { stdio: 'pipe' });
        this.addResult('Prettier: Version check passed');
        
        // Test formatting
        execSync('echo "const test=1;" | npx prettier --stdin-filepath test.js', { stdio: 'pipe' });
        this.addResult('Prettier: Basic formatting test passed');
      } catch (error) {
        this.addResult('Prettier: Command execution failed', true);
      }
    }

    // TypeScript validation
    if (this.validateFileExists('tsconfig.json', 'TypeScript config')) {
      try {
        execSync('npx tsc --version', { stdio: 'pipe' });
        this.addResult('TypeScript: Version check passed');
        
        // Test type checking (without emitting files)
        execSync('npx tsc --noEmit --skipLibCheck', { stdio: 'pipe' });
        this.addResult('TypeScript: Type checking passed');
      } catch (error) {
        this.addResult('TypeScript: Type checking failed', false, true);
      }
    }

    // Pre-commit hooks validation
    if (this.validateFileExists('.husky/pre-commit', 'Pre-commit hooks')) {
      const content = fs.readFileSync('.husky/pre-commit', 'utf8');
      if (content.includes('npx tsc --noEmit')) {
        this.addResult('Pre-commit hooks: Includes TypeScript checking');
      }
      if (content.includes('npx eslint')) {
        this.addResult('Pre-commit hooks: Includes ESLint');
      }
      if (content.includes('npx prettier')) {
        this.addResult('Pre-commit hooks: Includes Prettier');
      }
    }

    // Lint-staged validation
    this.validateFileExists('lint-staged.config.js', 'Lint-staged config');
  }

  validateTesting() {
    console.log('\n🧪 Validating Testing Infrastructure...\n');

    // Vitest validation
    if (this.validateFileExists('vitest.config.ts', 'Vitest main config')) {
      try {
        execSync('npx vitest --version', { stdio: 'pipe' });
        this.addResult('Vitest: Version check passed');

        // Check coverage configuration
        const content = fs.readFileSync('vitest.config.ts', 'utf8');
        if (content.includes('coverage')) {
          this.addResult('Vitest: Coverage configuration found');
        }
        if (content.includes('thresholds')) {
          this.addResult('Vitest: Coverage thresholds configured');
        }
      } catch (error) {
        this.addResult('Vitest: Command execution failed', true);
      }
    }

    // Test environment configs
    const testConfigs = [
      'test/integration/vitest.config.ts',
      'test/e2e/vitest.config.ts',
      'test/components/vitest.config.ts'
    ];

    testConfigs.forEach(config => {
      this.validateFileExists(config, `Test config: ${config}`);
    });

    // Test setup file
    this.validateFileExists('test/setup.ts', 'Test setup file');
  }

  validateSecurity() {
    console.log('\n🔒 Validating Security Configuration...\n');

    // Dependabot
    this.validateFileExists('.github/dependabot.yml', 'Dependabot configuration');

    // Code owners
    this.validateFileExists('.github/CODEOWNERS', 'Code owners file');

    // Environment template
    this.validateFileExists('.env.example', 'Environment template');

    // Git ignore
    if (this.validateFileExists('.gitignore', 'Git ignore file')) {
      const content = fs.readFileSync('.gitignore', 'utf8');
      const securityPatterns = ['.env', 'node_modules', 'dist', '.cache'];
      securityPatterns.forEach(pattern => {
        if (content.includes(pattern)) {
          this.addResult(`Git ignore: Excludes ${pattern}`);
        } else {
          this.addResult(`Git ignore: Missing ${pattern}`, false, true);
        }
      });
    }

    // Security audit
    try {
      execSync('npm audit --audit-level high', { stdio: 'pipe' });
      this.addResult('Security audit: No high-severity vulnerabilities');
    } catch (error) {
      const output = error.stdout.toString();
      if (output.includes('vulnerabilities')) {
        this.addResult('Security audit: Vulnerabilities found - review required', false, true);
      } else {
        this.addResult('Security audit: Command failed', true);
      }
    }
  }

  validateDeveloperExperience() {
    console.log('\n👥 Validating Developer Experience...\n');

    // VS Code configuration
    const vscodeFiles = [
      '.vscode/settings.json',
      '.vscode/extensions.json',
      '.vscode/launch.json'
    ];

    vscodeFiles.forEach(file => {
      this.validateFileExists(file, `VS Code config: ${file}`);
    });

    // Package.json scripts
    if (this.validateFileExists('package.json', 'Package.json')) {
      try {
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        const scripts = packageJson.scripts || {};
        
        const essentialScripts = ['dev', 'build', 'test'];
        essentialScripts.forEach(script => {
          if (scripts[script]) {
            this.addResult(`Package scripts: Has ${script} script`);
          } else {
            this.addResult(`Package scripts: Missing ${script} script`, false, true);
          }
        });

        const enhancedScripts = ['lint', 'format', 'typecheck'];
        let enhancedCount = 0;
        enhancedScripts.forEach(script => {
          if (scripts[script]) {
            enhancedCount++;
          }
        });

        if (enhancedCount === enhancedScripts.length) {
          this.addResult('Package scripts: All enhanced scripts present');
        } else {
          this.addResult(`Package scripts: ${enhancedCount}/${enhancedScripts.length} enhanced scripts present`, false, true);
        }

      } catch (error) {
        this.addResult('Package.json: Failed to parse', true);
      }
    }

    // GitHub templates
    this.validateFileExists('.github/pull_request_template.md', 'Pull request template');
    
    // Issue templates directory
    if (fs.existsSync('.github/ISSUE_TEMPLATE')) {
      this.addResult('GitHub: Issue templates directory found');
    } else {
      this.addResult('GitHub: Issue templates directory missing', false, true);
    }
  }

  generateSummary() {
    console.log('\n📊 COMPREHENSIVE CI/CD VALIDATION SUMMARY');
    console.log('==========================================\n');

    console.log(`✅ Passed: ${this.passed.length}`);
    console.log(`⚠️  Warnings: ${this.warnings.length}`);
    console.log(`❌ Errors: ${this.errors.length}\n`);

    if (this.errors.length > 0) {
      console.log('🚨 CRITICAL ISSUES THAT NEED IMMEDIATE ATTENTION:');
      this.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
      console.log('');
    }

    if (this.warnings.length > 0) {
      console.log('⚠️  WARNINGS TO ADDRESS:');
      this.warnings.forEach((warning, index) => {
        console.log(`${index + 1}. ${warning}`);
      });
      console.log('');
    }

    // Calculate overall health score
    const totalChecks = this.passed.length + this.warnings.length + this.errors.length;
    const healthScore = Math.round(((this.passed.length + (this.warnings.length * 0.5)) / totalChecks) * 100);

    console.log(`🎯 OVERALL CI/CD HEALTH SCORE: ${healthScore}%\n`);

    if (healthScore >= 95) {
      console.log('🎉 EXCELLENT - CI/CD pipeline is in excellent condition');
    } else if (healthScore >= 85) {
      console.log('🏅 GOOD - CI/CD pipeline is working well with minor issues');
    } else if (healthScore >= 70) {
      console.log('⚠️  NEEDS ATTENTION - Several issues need to be addressed');
    } else {
      console.log('🚨 CRITICAL - Major issues need immediate attention');
    }

    console.log('\n🚀 RECOMMENDATIONS:');
    if (this.errors.length > 0) {
      console.log('• Fix all critical errors before deployment');
    }
    if (this.warnings.length > 0) {
      console.log('• Address warnings to improve reliability');
    }
    console.log('• Regularly run this validation script');
    console.log('• Keep dependencies updated');
    console.log('• Monitor CI/CD pipeline performance');

    return {
      healthScore,
      passed: this.passed.length,
      warnings: this.warnings.length,
      errors: this.errors.length,
      isHealthy: this.errors.length === 0 && healthScore >= 85
    };
  }

  async runFullValidation() {
    console.log('🎯 COMPREHENSIVE CI/CD VALIDATION');
    console.log('==================================\n');

    this.validateWorkflows();
    this.validateCodeQuality();
    this.validateTesting();
    this.validateSecurity();
    this.validateDeveloperExperience();

    return this.generateSummary();
  }
}

// Run the validation
const validator = new CICDValidator();
validator.runFullValidation().then((results) => {
  if (results.isHealthy) {
    console.log('\n✅ CI/CD pipeline validation completed successfully!');
    process.exit(0);
  } else {
    console.log('\n❌ CI/CD pipeline validation found issues that need attention.');
    process.exit(1);
  }
}).catch((error) => {
  console.error('\n💥 Validation script failed:', error);
  process.exit(1);
});