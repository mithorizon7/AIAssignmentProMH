// Test script to verify consistent shareable code handling
import fetch from 'node-fetch';

async function testShareableCodeConsistency() {
  console.log('Testing shareable code consistency across endpoints:');
  
  try {
    // Test 1: Check if the endpoint requires a minimum code length
    console.log('\nTest 1: Verify minimum code length requirement');
    const invalidCodeResponse = await fetch('http://localhost:5000/api/assignments/code/123');
    console.log(`Invalid code (too short) returns: ${invalidCodeResponse.status} ${invalidCodeResponse.statusText}`);
    
    if (invalidCodeResponse.status === 400) {
      console.log('✓ API correctly rejects codes that are too short');
    } else {
      console.log('❌ API does not properly validate minimum code length');
    }
    
    // Test 2: Get a shareable code for an assignment that might not have one
    // This tests the auto-generation and consistent return of a code
    console.log('\nTest 2: Check code generation for assignments without codes');
    
    // First, let's try to get assignments to find one to test
    const assignmentsResponse = await fetch('http://localhost:5000/api/assignments');
    
    // If we can't access assignments (likely due to auth), just mock a test
    if (!assignmentsResponse.ok) {
      console.log('Note: Could not access assignments list (authentication required)');
      console.log('Simulating test by checking if assignment code endpoint handles missing codes properly');
      
      // We'll test the code generation indirectly through the error message
      const testCodeResponse = await fetch('http://localhost:5000/api/assignments/code/TESTCODE123456');
      const foundCodeData = await testCodeResponse.json();
      
      if (testCodeResponse.status === 404) {
        console.log('✓ API returns 404 for non-existent codes, not a code format error');
        console.log('  This indicates proper code validation separate from existence check');
      } else {
        console.log('❓ Unexpected response from API, unable to determine code consistency');
      }
    } else {
      // If we can access assignments, test with real data
      const assignments = await assignmentsResponse.json();
      
      if (assignments.length > 0) {
        const testAssignment = assignments[0];
        console.log(`Testing with assignment ID: ${testAssignment.id}`);
        
        // Get the assignment details to check for shareable code
        const detailsResponse = await fetch(`http://localhost:5000/api/assignments/${testAssignment.id}/details`);
        
        if (detailsResponse.ok) {
          const details = await detailsResponse.json();
          console.log(`Assignment has shareable code: ${details.shareableCode}`);
          
          if (details.shareableCode) {
            console.log('✓ API correctly includes a shareable code in assignment details');
            
            // Now check if we can access the assignment via the code
            const codeResponse = await fetch(`http://localhost:5000/api/assignments/code/${details.shareableCode}`);
            
            if (codeResponse.ok) {
              const assignmentByCode = await codeResponse.json();
              
              if (assignmentByCode.shareableCode === details.shareableCode) {
                console.log('✓ Consistent shareable code between endpoints');
              } else {
                console.log('❌ Inconsistent shareable codes between endpoints');
                console.log(`Details endpoint: ${details.shareableCode}`);
                console.log(`Code lookup endpoint: ${assignmentByCode.shareableCode}`);
              }
            } else {
              console.log('❌ Could not access assignment by shareable code');
            }
          } else {
            console.log('❌ No shareable code found in assignment details');
          }
        } else {
          console.log('Could not access assignment details (likely auth required)');
        }
      } else {
        console.log('No assignments found for testing');
      }
    }
    
  } catch (error) {
    console.error('Error testing shareable code consistency:', error);
  }
  
  console.log('\nShareable code consistency testing complete!');
}

// Run test
testShareableCodeConsistency();
