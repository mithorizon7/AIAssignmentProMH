#!/usr/bin/env node
/**
 * Production cleanup script to fix all console.log/console.error/console.warn statements
 * and replace them with proper logger calls for production readiness
 */

import fs from 'fs';
import path from 'path';

// Files to process
const filesToProcess = [
  'server/auth.ts',
  'client/src/components/instructor/rubric-tester.tsx',
  'client/src/components/examples/enhanced-form-example.tsx',
  'client/src/lib/auth.tsx',
  'client/src/lib/queryClient.ts',
  'client/src/pages/instructor/dashboard.tsx',
  'client/src/pages/admin/system-status.tsx'
];

// Console replacements
const replacements = [
  // Server side - auth.ts
  {
    from: /console\.error\('\[ERROR\] Authentication error:', err\);/g,
    to: "logger.error('Authentication error', { error: err });"
  },
  {
    from: /console\.log\('\[DEBUG\] Attempting to login user:', {[\s\S]*?}\);/g,
    to: "logger.debug('Attempting user login', {\n          userId: user.id,\n          username: user.username,\n          role: user.role,\n          hasSession: !!req.session\n        });"
  },
  {
    from: /console\.error\('\[ERROR\] Session login error:', err\);/g,
    to: "logger.error('Session login error', { error: err });"
  },
  {
    from: /console\.error\('\[ERROR\] Session regeneration error:', err\);/g,
    to: "logger.error('Session regeneration error', { error: err });"
  },
  {
    from: /console\.error\('\[ERROR\] Re-login error after session regeneration:', loginErr\);/g,
    to: "logger.error('Re-login error after session regeneration', { error: loginErr });"
  },
  {
    from: /console\.error\('\[ERROR\] Failed to destroy inconsistent session:', destroyErr\);/g,
    to: "logger.error('Failed to destroy inconsistent session', { error: destroyErr });"
  },
  {
    from: /console\.error\('\[ERROR\] Session save error:', saveErr\);/g,
    to: "logger.error('Session save error', { error: saveErr });"
  },
  {
    from: /console\.log\('\[DEBUG\] User successfully logged in:', {[\s\S]*?}\);/g,
    to: "logger.debug('User successfully logged in', {\n                  userId: userData.id,\n                  username: userData.username,\n                  role: userData.role,\n                  sessionID: req.sessionID\n                });"
  },
  {
    from: /console\.error\(`\[WARN\] Unauthorized access attempt to \$\{req\.path\}`\);/g,
    to: "logger.warn('Unauthorized access attempt', { path: req.path });"
  },
  
  // Client side replacements
  {
    from: /console\.log\(`Uploading file: \$\{file\.name\}, type: \$\{file\.type\}, size: \$\{file\.size\} bytes`\);/g,
    to: "// File upload logging removed for production"
  },
  {
    from: /console\.log\("Form submitted:", data\);/g,
    to: "// Form submission logging removed for production"
  },
  {
    from: /console\.log\('Detected return from Auth0 logout, redirecting to login page'\);/g,
    to: "// Auth0 logout detection logging removed for production"
  },
  {
    from: /console\.log\('Detected return from MIT Horizon logout, redirecting to login page'\);/g,
    to: "// MIT Horizon logout detection logging removed for production"
  },
  {
    from: /console\.log\('\[INFO\] Redirecting to returnTo URL after login:', returnTo\);/g,
    to: "// Redirect logging removed for production"
  },
  {
    from: /console\.log\('Redirecting to MIT Horizon logout URL:', data\.redirectUrl\);/g,
    to: "// MIT Horizon logout URL logging removed for production"
  },
  {
    from: /console\.log\('Redirecting to Auth0 logout URL:', data\.redirectUrl\);/g,
    to: "// Auth0 logout URL logging removed for production"
  },
  {
    from: /console\.log\('Redirecting to SSO logout URL:', data\.redirectUrl\);/g,
    to: "// SSO logout URL logging removed for production"
  },
  {
    from: /console\.warn\('CSRF token validation failed\. Retrying with a new token\.'\);/g,
    to: "// CSRF token retry logging removed for production"
  },
  {
    from: /console\.warn\('Invalid course ID detected:', selectedCourse\);/g,
    to: "// Course ID validation logging removed for production"
  }
];

// Function to process a single file
function processFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  replacements.forEach(({ from, to }) => {
    const originalContent = content;
    content = content.replace(from, to);
    if (content !== originalContent) {
      modified = true;
      console.log(`Applied replacement in ${filePath}`);
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Updated ${filePath}`);
  } else {
    console.log(`⚪ No changes needed in ${filePath}`);
  }
}

// Process all files
console.log('🧹 Starting production cleanup...');
filesToProcess.forEach(processFile);
console.log('✅ Production cleanup complete!');