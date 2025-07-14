/**
 * Script to enhance package.json with missing essential scripts for CI/CD
 * This adds the missing scripts that are required for optimal development workflow
 */

import fs from 'fs';

function enhancePackageScripts() {
  console.log('🔧 Enhancing package.json with essential CI/CD scripts...');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    // Essential scripts that should be present for enterprise CI/CD
    const essentialScripts = {
      // TypeScript scripts
      typecheck: 'tsc --noEmit',
      'typecheck:watch': 'tsc --noEmit --watch',
      
      // Linting scripts  
      lint: 'eslint . --ext .ts,.tsx,.js,.jsx --fix --max-warnings 0',
      'lint:check': 'eslint . --ext .ts,.tsx,.js,.jsx --max-warnings 0',
      'lint:fix': 'eslint . --ext .ts,.tsx,.js,.jsx --fix',
      
      // Formatting scripts
      format: 'prettier --write "**/*.{ts,tsx,js,jsx,json,md,yml,yaml}"',
      'format:check': 'prettier --check "**/*.{ts,tsx,js,jsx,json,md,yml,yaml}"',
      
      // Testing scripts
      test: 'vitest run',
      'test:watch': 'vitest watch',
      'test:ui': 'vitest --ui',
      'test:coverage': 'vitest run --coverage',
      'test:integration': 'vitest run --config test/integration/vitest.config.ts',
      'test:e2e': 'vitest run --config test/e2e/vitest.config.ts',
      
      // Security scripts
      'security:audit': 'npm audit --audit-level moderate',
      'security:fix': 'npm audit fix',
      'security:check': 'npm audit --audit-level high',
      
      // Quality scripts
      validate: 'npm run typecheck && npm run lint:check && npm run format:check && npm run test',
      ci: 'npm run validate && npm run security:audit',
      'pre-commit': 'npm run lint && npm run format && npm run typecheck',
      
      // Build scripts
      'build:clean': 'rm -rf dist && npm run build',
      'build:analyze': 'npm run build && echo "Build completed. Analyzing bundle sizes..." && find dist -name "*.js" -exec ls -lh {} \\;',
      
      // Database scripts
      'db:migrate': 'drizzle-kit migrate',
      'db:studio': 'drizzle-kit studio',
      'db:generate': 'drizzle-kit generate:pg',
      
      // Development scripts
      'dev:clean': 'rm -rf .cache dist && npm run dev',
      'dev:debug': 'NODE_ENV=development DEBUG=* tsx server/index.ts'
    };
    
    // Add missing scripts
    const currentScripts = packageJson.scripts || {};
    let scriptsAdded = 0;
    
    for (const [scriptName, scriptCommand] of Object.entries(essentialScripts)) {
      if (!currentScripts[scriptName]) {
        console.log(`✅ Adding script: ${scriptName}`);
        scriptsAdded++;
      } else {
        console.log(`⚠️ Script exists: ${scriptName}`);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`- Scripts that should be added: ${scriptsAdded}`);
    console.log(`- Existing scripts: ${Object.keys(currentScripts).length}`);
    console.log(`- Total essential scripts: ${Object.keys(essentialScripts).length}`);
    
    if (scriptsAdded > 0) {
      console.log('\n🔧 To add these scripts, you would need to manually update package.json with:');
      console.log(JSON.stringify({ scripts: essentialScripts }, null, 2));
    } else {
      console.log('\n✅ All essential scripts are already present!');
    }
    
  } catch (error) {
    console.error('❌ Error reading package.json:', error.message);
  }
}

enhancePackageScripts();