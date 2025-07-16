/**
 * Comprehensive Submission System Tests
 * 
 * This test suite verifies:
 * 1. Image submission workflow with actual image file
 * 2. Text submission workflow with essay content
 * 3. CSRF token handling
 * 4. Authentication flow
 * 5. AI feedback generation
 * 6. Error handling and recovery
 */

import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

// Test configuration
const BASE_URL = 'http://localhost:5000';
const IMAGE_PATH = 'attached_assets/gurulost_tasty_looking_cheese_--ar_43_--stylize_150_--v_7_b12e7149-a36a-4151-b975-0a9c53759f4d_1_1752700479144.png';

// Test essay content about anger
const ANGER_ESSAY = `
The Nature of Anger: Understanding Our Most Volatile Emotion

Anger is perhaps one of the most misunderstood and complex emotions in the human experience. While often viewed as destructive or negative, anger serves important psychological and social functions that have evolved over millennia. This essay explores the multifaceted nature of anger, its biological underpinnings, psychological mechanisms, and its role in both personal development and social dynamics.

From a biological perspective, anger activates the body's fight-or-flight response, flooding the system with stress hormones like adrenaline and cortisol. This physiological reaction prepares us to confront perceived threats or injustices. The amygdala, our brain's alarm system, triggers this response before the prefrontal cortex can fully process the situation, which explains why anger can feel so immediate and overwhelming.

Psychologically, anger often serves as a secondary emotion, masking deeper feelings of hurt, fear, or vulnerability. When we feel powerless or threatened, anger can provide a sense of control and strength. It signals to others that our boundaries have been crossed and that we demand respect or change. In this way, anger can be a catalyst for necessary confrontations and social change.

However, uncontrolled anger can be destructive to relationships and personal well-being. Learning to recognize anger's triggers, understand its underlying causes, and develop healthy expression techniques is crucial for emotional maturity. Techniques such as mindfulness, cognitive restructuring, and effective communication can help transform anger from a destructive force into a constructive tool for personal growth and social justice.

In conclusion, anger is neither inherently good nor bad – it is a natural human emotion that requires understanding and skillful management. By recognizing its purpose and learning to channel it constructively, we can harness anger's energy for positive change while maintaining our relationships and mental health.
`;

class SubmissionTestSuite {
  constructor() {
    this.cookies = '';
    this.csrfToken = '';
    this.userId = null;
    this.assignments = [];
    this.testResults = [];
  }

  async log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    console.log(logEntry);
    
    this.testResults.push({
      timestamp,
      type,
      message,
      success: type === 'success',
      error: type === 'error'
    });
  }

  async makeRequest(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Cookie': this.cookies,
      },
    });

    // Update cookies if received
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      this.cookies = setCookieHeader.split(';')[0];
    }

    return response;
  }

  async getCSRFToken() {
    try {
      const response = await this.makeRequest(`${BASE_URL}/api/csrf-token`);
      if (response.ok) {
        const data = await response.json();
        this.csrfToken = data.csrfToken;
        await this.log(`CSRF token obtained: ${this.csrfToken.substring(0, 10)}...`, 'success');
        return true;
      } else {
        await this.log(`Failed to get CSRF token: ${response.status}`, 'error');
        return false;
      }
    } catch (error) {
      await this.log(`CSRF token error: ${error.message}`, 'error');
      return false;
    }
  }

  async authenticateUser() {
    try {
      // Check if already authenticated
      const authResponse = await this.makeRequest(`${BASE_URL}/api/auth/user`);
      if (authResponse.ok) {
        const user = await authResponse.json();
        this.userId = user.id;
        await this.log(`User authenticated: ${user.name} (ID: ${user.id})`, 'success');
        return true;
      }
      
      await this.log('User not authenticated - tests will run as anonymous', 'info');
      return false;
    } catch (error) {
      await this.log(`Authentication check error: ${error.message}`, 'error');
      return false;
    }
  }

  async getAssignments() {
    try {
      if (this.userId) {
        // If authenticated, get assignments through normal API
        const response = await this.makeRequest(`${BASE_URL}/api/assignments`);
        if (response.ok) {
          this.assignments = await response.json();
          await this.log(`Found ${this.assignments.length} assignments`, 'success');
          
          // Log assignment details
          this.assignments.forEach(assignment => {
            this.log(`Assignment: ${assignment.title} (ID: ${assignment.id})`, 'info');
          });
          
          return true;
        } else {
          await this.log(`Failed to get assignments: ${response.status}`, 'error');
          return false;
        }
      } else {
        // If not authenticated, try to get assignments by shareable codes
        // These are known shareable codes from the system
        const shareableCodes = ['DBC22A3B', '8EE24063', '4D8024E9', '20398135', '23FAFEF0'];
        
        for (const code of shareableCodes) {
          try {
            const response = await this.makeRequest(`${BASE_URL}/api/assignments/code/${code}`);
            if (response.ok) {
              const assignment = await response.json();
              this.assignments.push(assignment);
              await this.log(`Found assignment: ${assignment.title} (Code: ${code})`, 'success');
            }
          } catch (error) {
            // Continue to next code if this one fails
            continue;
          }
        }
        
        if (this.assignments.length > 0) {
          await this.log(`Found ${this.assignments.length} assignments via shareable codes`, 'success');
          return true;
        } else {
          await this.log('No assignments found via shareable codes', 'error');
          return false;
        }
      }
    } catch (error) {
      await this.log(`Assignment retrieval error: ${error.message}`, 'error');
      return false;
    }
  }

  async testImageSubmission() {
    await this.log('Starting image submission test...', 'info');
    
    try {
      // Find a suitable assignment for image submission
      const imageAssignment = this.assignments.find(a => 
        a.title.toLowerCase().includes('photo') || 
        a.title.toLowerCase().includes('image') ||
        a.title.toLowerCase().includes('cheese')
      );
      
      if (!imageAssignment) {
        await this.log('No suitable image assignment found', 'error');
        return false;
      }

      await this.log(`Testing image submission for: ${imageAssignment.title}`, 'info');

      // Check if image file exists
      if (!fs.existsSync(IMAGE_PATH)) {
        await this.log(`Image file not found: ${IMAGE_PATH}`, 'error');
        return false;
      }

      // Get fresh CSRF token
      if (!await this.getCSRFToken()) {
        return false;
      }

      // Create form data
      const formData = new FormData();
      formData.append('assignmentId', imageAssignment.id.toString());
      formData.append('submissionType', 'file');
      formData.append('csrfToken', this.csrfToken);
      formData.append('notes', 'Test submission: Delicious cheese image with excellent presentation');
      formData.append('file', fs.createReadStream(IMAGE_PATH));

      // If not authenticated, add anonymous submission fields
      if (!this.userId) {
        formData.append('name', 'Test User');
        formData.append('email', 'test@example.com');
        formData.append('shareableCode', imageAssignment.shareableCode);
      }

      // Submit the image
      const endpoint = this.userId ? `${BASE_URL}/api/submissions` : `${BASE_URL}/api/anonymous-submissions`;
      const response = await this.makeRequest(endpoint, {
        method: 'POST',
        body: formData,
        headers: {
          'X-CSRF-Token': this.csrfToken,
        },
      });

      if (response.ok) {
        const result = await response.json();
        await this.log(`Image submission successful: ID ${result.id}`, 'success');
        
        // Monitor submission processing
        await this.monitorSubmissionProcessing(result.id);
        return true;
      } else {
        const errorText = await response.text();
        await this.log(`Image submission failed: ${response.status} - ${errorText}`, 'error');
        return false;
      }
    } catch (error) {
      await this.log(`Image submission error: ${error.message}`, 'error');
      return false;
    }
  }

  async testTextSubmission() {
    await this.log('Starting text submission test...', 'info');
    
    try {
      // Find a suitable assignment for text submission
      const textAssignment = this.assignments.find(a => 
        a.title.toLowerCase().includes('essay') || 
        a.title.toLowerCase().includes('text') ||
        a.title.toLowerCase().includes('anger')
      );
      
      if (!textAssignment) {
        await this.log('No suitable text assignment found', 'error');
        return false;
      }

      await this.log(`Testing text submission for: ${textAssignment.title}`, 'info');

      // Get fresh CSRF token
      if (!await this.getCSRFToken()) {
        return false;
      }

      // Create form data
      const formData = new FormData();
      formData.append('assignmentId', textAssignment.id.toString());
      formData.append('submissionType', 'code');
      formData.append('csrfToken', this.csrfToken);
      formData.append('notes', 'Test submission: Comprehensive essay on anger management');
      formData.append('code', ANGER_ESSAY);

      // If not authenticated, add anonymous submission fields
      if (!this.userId) {
        formData.append('name', 'Test User');
        formData.append('email', 'test@example.com');
        formData.append('shareableCode', textAssignment.shareableCode);
      }

      // Submit the essay
      const endpoint = this.userId ? `${BASE_URL}/api/submissions` : `${BASE_URL}/api/anonymous-submissions`;
      const response = await this.makeRequest(endpoint, {
        method: 'POST',
        body: formData,
        headers: {
          'X-CSRF-Token': this.csrfToken,
        },
      });

      if (response.ok) {
        const result = await response.json();
        await this.log(`Text submission successful: ID ${result.id}`, 'success');
        
        // Monitor submission processing
        await this.monitorSubmissionProcessing(result.id);
        return true;
      } else {
        const errorText = await response.text();
        await this.log(`Text submission failed: ${response.status} - ${errorText}`, 'error');
        return false;
      }
    } catch (error) {
      await this.log(`Text submission error: ${error.message}`, 'error');
      return false;
    }
  }

  async monitorSubmissionProcessing(submissionId) {
    await this.log(`Monitoring submission processing for ID: ${submissionId}`, 'info');
    
    const maxWaitTime = 30000; // 30 seconds
    const pollInterval = 2000; // 2 seconds
    let elapsed = 0;
    
    while (elapsed < maxWaitTime) {
      try {
        const response = await this.makeRequest(`${BASE_URL}/api/submissions`);
        if (response.ok) {
          const submissions = await response.json();
          const submission = submissions.find(s => s.id === submissionId);
          
          if (submission) {
            await this.log(`Submission ${submissionId} status: ${submission.status}`, 'info');
            
            if (submission.status === 'completed') {
              await this.log(`Submission ${submissionId} completed successfully`, 'success');
              
              // Check if feedback was generated
              if (submission.feedback && submission.feedback.length > 0) {
                await this.log(`Feedback generated for submission ${submissionId}`, 'success');
              } else {
                await this.log(`No feedback generated for submission ${submissionId}`, 'error');
              }
              
              return true;
            } else if (submission.status === 'failed') {
              await this.log(`Submission ${submissionId} failed processing`, 'error');
              return false;
            }
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        elapsed += pollInterval;
      } catch (error) {
        await this.log(`Error monitoring submission ${submissionId}: ${error.message}`, 'error');
        break;
      }
    }
    
    await this.log(`Submission ${submissionId} processing timeout after ${maxWaitTime}ms`, 'error');
    return false;
  }

  async testSystemHealth() {
    await this.log('Testing system health...', 'info');
    
    try {
      const response = await this.makeRequest(`${BASE_URL}/api/health`);
      if (response.ok) {
        const health = await response.json();
        await this.log(`System health: ${health.status} (Memory: ${health.memory.used}/${health.memory.total} MB)`, 'success');
        return true;
      } else {
        await this.log(`Health check failed: ${response.status}`, 'error');
        return false;
      }
    } catch (error) {
      await this.log(`Health check error: ${error.message}`, 'error');
      return false;
    }
  }

  async generateReport() {
    await this.log('Generating test report...', 'info');
    
    const successCount = this.testResults.filter(r => r.success).length;
    const errorCount = this.testResults.filter(r => r.error).length;
    const totalTests = this.testResults.filter(r => r.success || r.error).length;
    
    console.log('\n' + '='.repeat(60));
    console.log('COMPREHENSIVE SUBMISSION TEST REPORT');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${errorCount}`);
    console.log(`Success Rate: ${totalTests > 0 ? ((successCount / totalTests) * 100).toFixed(1) : 0}%`);
    console.log('='.repeat(60));
    
    if (errorCount > 0) {
      console.log('\nERRORS FOUND:');
      this.testResults.filter(r => r.error).forEach(result => {
        console.log(`- ${result.message}`);
      });
    }
    
    if (successCount > 0) {
      console.log('\nSUCCESSES:');
      this.testResults.filter(r => r.success).forEach(result => {
        console.log(`- ${result.message}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
    
    return {
      totalTests,
      successCount,
      errorCount,
      successRate: totalTests > 0 ? ((successCount / totalTests) * 100) : 0
    };
  }

  async runAllTests() {
    await this.log('Starting comprehensive submission tests...', 'info');
    
    // Test system health first
    await this.testSystemHealth();
    
    // Authenticate user
    await this.authenticateUser();
    
    // Get assignments
    await this.getAssignments();
    
    // Run submission tests
    await this.testImageSubmission();
    await this.testTextSubmission();
    
    // Generate report
    const report = await this.generateReport();
    
    return report;
  }
}

// Run the tests
async function runTests() {
  const testSuite = new SubmissionTestSuite();
  const report = await testSuite.runAllTests();
  
  console.log('\nTest execution completed.');
  console.log(`Final Status: ${report.successRate >= 80 ? 'PASS' : 'FAIL'}`);
  
  return report;
}

// Export for use in other files
export { SubmissionTestSuite, runTests };

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}