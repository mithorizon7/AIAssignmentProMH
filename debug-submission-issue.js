/**
 * Debug script to identify the exact SQL syntax error in createSubmission
 */

import { execute_sql_tool } from './test-tools.js';

async function debugSubmissionIssue() {
  console.log('🔍 Debugging submission database issue...\n');

  // Check the exact structure of the submissions table
  console.log('1. Checking submissions table structure...');
  try {
    const result = await fetch('http://localhost:5000/api/health');
    if (result.ok) {
      console.log('✅ API server is running');
    }
  } catch (error) {
    console.log('❌ API server not accessible:', error.message);
  }

  // Test a manual SQL insert to see what the exact issue is
  console.log('\n2. Testing manual SQL insert...');
  
  const testData = {
    assignmentId: 5,
    userId: 9997,
    fileUrl: 'test-url',
    fileName: 'test-file.txt',
    content: 'Test content',
    notes: 'Test notes',
    status: 'pending',
    mimeType: 'text/plain',
    fileSize: 100,
    contentType: 'text'
  };

  console.log('Test data:', JSON.stringify(testData, null, 2));
  
  console.log('\n3. This would help identify if the issue is with:');
  console.log('   - Data format');
  console.log('   - Column names');
  console.log('   - SQL syntax');
  console.log('   - Drizzle ORM configuration');
  
  console.log('\n4. Based on the error "syntax error at or near [", the issue is likely:');
  console.log('   - The values() method is receiving an array instead of object');
  console.log('   - The SQL generation is including square brackets');
  console.log('   - The contentType enum is causing issues');
  
  return true;
}

debugSubmissionIssue().catch(console.error);