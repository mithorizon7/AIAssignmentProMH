/**
 * Quick CI/CD validation script for immediate feedback
 */

import fs from 'fs';

console.log('🎯 QUICK CI/CD VALIDATION SUMMARY');
console.log('================================\n');

// Check essential files
const essentialFiles = [
  { file: '.github/workflows/ci.yml', name: 'CI Workflow' },
  { file: '.github/workflows/cd.yml', name: 'CD Workflow' },
  { file: '.github/workflows/security.yml', name: 'Security Workflow' },
  { file: '.github/workflows/quality-gate.yml', name: 'Quality Gate' },
  { file: '.github/workflows/dependency-update.yml', name: 'Dependency Updates' },
  { file: '.github/workflows/performance-monitoring.yml', name: 'Performance Monitoring' },
  { file: '.eslintrc.js', name: 'ESLint Config (Legacy)' },
  { file: 'eslint.config.js', name: 'ESLint Config (Flat)' },
  { file: '.prettierrc', name: 'Prettier Config' },
  { file: 'vitest.config.ts', name: 'Vitest Config' },
  { file: '.husky/pre-commit', name: 'Pre-commit Hooks' },
  { file: 'lint-staged.config.js', name: 'Lint-staged Config' },
  { file: '.github/dependabot.yml', name: 'Dependabot Config' },
  { file: '.github/CODEOWNERS', name: 'Code Owners' },
  { file: '.vscode/settings.json', name: 'VS Code Settings' },
  { file: '.vscode/extensions.json', name: 'VS Code Extensions' },
  { file: '.vscode/launch.json', name: 'VS Code Launch Config' }
];

let totalFiles = essentialFiles.length;
let foundFiles = 0;

console.log('📁 Essential Files Check:');
essentialFiles.forEach(item => {
  if (fs.existsSync(item.file)) {
    console.log(`✅ ${item.name}`);
    foundFiles++;
  } else {
    console.log(`❌ ${item.name} - Missing: ${item.file}`);
  }
});

const completionPercentage = Math.round((foundFiles / totalFiles) * 100);

console.log(`\n📊 File Completion: ${foundFiles}/${totalFiles} (${completionPercentage}%)`);

// Check package.json scripts
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const scripts = packageJson.scripts || {};
  
  console.log('\n📦 Package Scripts:');
  const expectedScripts = ['dev', 'build', 'check'];
  expectedScripts.forEach(script => {
    if (scripts[script]) {
      console.log(`✅ ${script} script`);
    } else {
      console.log(`❌ ${script} script - Missing`);
    }
  });
} catch (error) {
  console.log('❌ Failed to read package.json');
}

console.log('\n🎯 OVERALL ASSESSMENT:');
if (completionPercentage >= 95) {
  console.log('🎉 EXCELLENT - CI/CD pipeline is fully configured');
} else if (completionPercentage >= 85) {
  console.log('🏅 GOOD - CI/CD pipeline is well configured with minor gaps');
} else if (completionPercentage >= 70) {
  console.log('⚠️  NEEDS WORK - Several components missing');
} else {
  console.log('❌ CRITICAL - Major components missing');
}

console.log('\n🚀 READY FOR PRODUCTION:');
const requiredWorkflows = [
  '.github/workflows/ci.yml',
  '.github/workflows/cd.yml',
  '.github/workflows/security.yml'
];

const hasEssentials = requiredWorkflows.every(file => fs.existsSync(file));
if (hasEssentials && completionPercentage >= 85) {
  console.log('✅ CI/CD pipeline is production-ready');
} else {
  console.log('❌ CI/CD pipeline needs additional work before production');
}

process.exit(completionPercentage >= 85 ? 0 : 1);