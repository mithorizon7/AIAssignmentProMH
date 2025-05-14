// Test script to verify CSRF token security enhancements
import fetch from 'node-fetch';

async function testCsrfTokenSecurity() {
  console.log('Testing CSRF token security enhancements:');
  
  // Test 1: Verify CSRF token endpoint returns secure tokens
  try {
    const response = await fetch('http://localhost:5000/api/csrf-token');
    
    if (!response.ok) {
      console.error(`CSRF token endpoint error: ${response.status} ${response.statusText}`);
      return;
    }
    
    const data = await response.json();
    const token = data.csrfToken;
    
    console.log(`CSRF Token Generation: ${response.status} ${response.statusText}`);
    
    if (!token) {
      console.log('❌ No CSRF token returned');
      return;
    }
    
    console.log(`Token length: ${token.length} characters`);
    
    // Check token characteristics
    if (token.length >= 64) {
      console.log('✓ Token is sufficiently long (>=64 chars)');
    } else {
      console.log('❌ Token is too short for good security');
    }
    
    // Check token uniqueness by requesting a second token
    const response2 = await fetch('http://localhost:5000/api/csrf-token');
    const data2 = await response2.json();
    const token2 = data2.csrfToken;
    
    if (token !== token2) {
      console.log('✓ Tokens are unique for different requests');
    } else {
      console.log('❌ Tokens are identical across requests - insufficient entropy');
    }
    
    // Test CSRF validation with good and bad tokens
    // This part is harder to test in isolation without a browser session
    
  } catch (error) {
    console.error('Error testing CSRF token security:', error);
  }
  
  console.log('\nCSRF Security testing complete!');
}

// Run test
testCsrfTokenSecurity();
