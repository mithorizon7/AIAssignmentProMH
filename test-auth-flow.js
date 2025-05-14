import fetch from 'node-fetch';
import FormData from 'form-data';

async function testAuthRequiredForSubmissions() {
  console.log('Testing authentication requirements for submissions:');
  
  // Test anonymous submission route - should require auth
  try {
    const formData = new FormData();
    formData.append('assignmentId', '1');
    formData.append('name', 'Test User');
    formData.append('email', 'test@example.com');
    
    const anonResponse = await fetch('http://localhost:5000/api/anonymous-submissions', {
      method: 'POST',
      body: formData
    });
    
    console.log(`Anonymous submission endpoint returned: ${anonResponse.status} ${anonResponse.statusText}`);
    const responseText = await anonResponse.text();
    console.log('Response:', responseText);
    
    if (anonResponse.status === 401) {
      console.log('✓ Anonymous submissions endpoint properly requires authentication');
    } else {
      console.log('❌ Anonymous submissions endpoint does not require authentication!');
    }
  } catch (error) {
    console.error('Error testing anonymous submissions:', error);
  }
  
  // Test authenticated submission route - should require auth
  try {
    const formData = new FormData();
    formData.append('assignmentId', '1');
    
    const authResponse = await fetch('http://localhost:5000/api/submissions', {
      method: 'POST',
      body: formData
    });
    
    console.log(`Authenticated submission endpoint returned: ${authResponse.status} ${authResponse.statusText}`);
    const responseText = await authResponse.text();
    console.log('Response:', responseText);
    
    if (authResponse.status === 401) {
      console.log('✓ Authenticated submissions endpoint properly requires authentication');
    } else {
      console.log('❌ Authenticated submissions endpoint does not require authentication!');
    }
  } catch (error) {
    console.error('Error testing authenticated submissions:', error);
  }
  
  // Test shareable link assignment lookup - should not require auth but should return requiresAuth flag
  try {
    const testCode = 'TEST123'; // Use a code that likely doesn't exist
    const response = await fetch(`http://localhost:5000/api/assignments/code/${testCode}`);
    
    console.log(`Shareable link endpoint returned: ${response.status} ${response.statusText}`);
    
    // Even if the assignment is not found, the API should still respond
    if (response.status !== 401) {
      console.log('✓ Shareable link endpoint is accessible without auth');
    } else {
      console.log('❌ Shareable link endpoint requires authentication to view!');
    }
  } catch (error) {
    console.error('Error testing shareable link endpoint:', error);
  }
}

// Run tests
testAuthRequiredForSubmissions();
