const fetch = require('node-fetch');
const FormData = require('form-data');

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
    console.log('Response:', await anonResponse.text());
    console.log('✓ Anonymous submissions endpoint properly requires authentication');
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
    console.log('Response:', await authResponse.text());
    console.log('✓ Authenticated submissions endpoint properly requires authentication');
  } catch (error) {
    console.error('Error testing authenticated submissions:', error);
  }
}

// Run tests
testAuthRequiredForSubmissions();
