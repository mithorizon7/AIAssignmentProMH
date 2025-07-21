/**
 * Global Setup for AI Feedback Tests
 * 
 * This file handles global setup and teardown for the entire test suite
 */

export async function setup() {
  console.log('🚀 Starting global setup for AI Feedback tests...');
  
  // Setup test environment
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  
  // Create test reports directory
  const fs = await import('fs/promises');
  const path = await import('path');
  
  const reportsDir = path.join(process.cwd(), 'test', 'reports');
  
  try {
    await fs.mkdir(reportsDir, { recursive: true });
    console.log('📁 Test reports directory created');
  } catch (error) {
    // Directory might already exist
  }
  
  console.log('✅ Global setup complete');
}

export async function teardown() {
  console.log('🧹 Starting global teardown...');
  
  // Add any global cleanup logic here
  
  console.log('✅ Global teardown complete');
}