// Test script to verify authentication requirements and SQL security fixes
import fetch from 'node-fetch';
import FormData from 'form-data';

async function testSecurityFixes() {
  console.log('Testing security fixes:');
  
  // Test 1: Authentication requirements for submissions
  try {
    const formData = new FormData();
    formData.append('assignmentId', '1');
    
    const authResponse = await fetch('http://localhost:5000/api/submissions', {
      method: 'POST',
      body: formData
    });
    
    console.log(`Authentication test: ${authResponse.status} ${authResponse.statusText}`);
    if (authResponse.status === 401) {
      console.log('✓ Authentication requirement working correctly');
    } else {
      console.log('❌ Authentication requirement failed');
    }
  } catch (error) {
    console.error('Error testing authentication:', error);
  }
  
  // Test 2: SQL Injection protection for parameterized queries
  // This is harder to test directly, but we can verify the endpoints still work
  try {
    // Test a shareable link with special characters that would break SQL
    const testCode = "TEST123'--"; // SQL injection attempt in the code
    const response = await fetch(`http://localhost:5000/api/assignments/code/${testCode}`);
    
    console.log(`SQL Injection test 1: ${response.status}`);
    // The endpoint should either return 404 (not found) or 200 (found)
    // but NOT 500 (server error) which would indicate an SQL injection vulnerability
    if (response.status !== 500) {
      console.log('✓ SQL Injection protection likely working (no server error)');
    } else {
      console.log('❌ Possible SQL vulnerability (server error on malicious input)');
      const errorText = await response.text();
      console.log('Error details:', errorText);
    }
  } catch (error) {
    console.error('Error testing SQL injection protection:', error);
  }
  
  console.log('\nSecurity testing complete!');
}

// Run tests
testSecurityFixes();
