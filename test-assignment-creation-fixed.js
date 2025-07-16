/**
 * Test assignment creation with the CSRF fix
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:5000';

// Create an axios instance with proper cookie handling
const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

async function testAssignmentCreation() {
  console.log('🚀 Testing Assignment Creation (After CSRF Fix)');
  console.log('===============================================');
  
  try {
    // Step 1: Login with test credentials
    console.log('1. Logging in as instructor...');
    const loginData = {
      username: 'instructor@test.com',
      password: 'instructor123'
    };
    
    const loginResponse = await apiClient.post('/api/auth/login', loginData);
    
    if (loginResponse.status === 200) {
      console.log('   ✅ Login successful');
    } else {
      throw new Error(`Login failed with status: ${loginResponse.status}`);
    }
    
    // Step 2: Get CSRF token
    console.log('2. Getting CSRF token...');
    const csrfResponse = await apiClient.get('/api/csrf-token');
    
    const csrfToken = csrfResponse.data.csrfToken;
    console.log('   ✅ CSRF token:', csrfToken.substring(0, 15) + '...');
    
    // Step 3: Create assignment
    console.log('3. Creating assignment...');
    const assignmentData = {
      title: 'CSRF Fix Test Assignment',
      description: 'Testing assignment creation after fixing CSRF token synchronization',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      rubric: {
        criteria: [
          {
            id: 'test-criteria',
            type: 'criteria', 
            name: 'Test Quality',
            description: 'How well the test validates the fix',
            maxScore: 25,
            weight: 1
          }
        ],
        passingThreshold: 60
      }
    };
    
    const response = await apiClient.post('/api/assignments', assignmentData, {
      headers: {
        'X-CSRF-Token': csrfToken
      }
    });
    
    if (response.status === 201) {
      console.log('   ✅ Assignment created successfully!');
      console.log('   📋 Details:');
      console.log('      ID:', response.data.id);
      console.log('      Title:', response.data.title);
      console.log('      Shareable Code:', response.data.shareableCode);
      
      console.log('\n🎉 SUCCESS: CSRF issue has been resolved!');
      console.log('Assignment creation is now working correctly.');
      return true;
    }
    
  } catch (error) {
    console.error('❌ Test failed:');
    console.error('   Status:', error.response?.status);
    console.error('   Message:', error.response?.data?.message || error.message);
    console.error('   Error:', error.response?.data?.error || 'Unknown error');
    
    if (error.response?.status === 403 && error.response?.data?.error === 'Invalid CSRF token') {
      console.log('\n💡 The CSRF issue is still present. Debugging...');
      
      // Test getting a fresh token
      try {
        const freshResponse = await apiClient.get('/api/csrf-token');
        console.log('   Fresh token:', freshResponse.data.csrfToken.substring(0, 15) + '...');
        console.log('   Same as before?', freshResponse.data.csrfToken === csrfToken);
      } catch (e) {
        console.log('   Failed to get fresh token:', e.message);
      }
    }
    
    return false;
  }
}

testAssignmentCreation().catch(console.error);