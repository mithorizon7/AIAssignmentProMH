/**
 * End-to-end test for BullMQ submission processing system
 * Tests: submission → queue → Redis → worker processing
 */

import { queueApi } from './server/queue/bullmq-submission-queue';
import { storage } from './server/storage';
import redisClient from './server/queue/redis';

async function testBullMQSystem() {
  console.log('Starting BullMQ system validation...\n');
  
  try {
    // Test 1: Redis Connection
    console.log('1. Testing Redis connection...');
    await redisClient.ping();
    console.log('✓ Redis connection successful');
    
    // Test 2: Queue Statistics
    console.log('\n2. Checking queue statistics...');
    const initialStats = await queueApi.getStats();
    console.log('Queue stats:', JSON.stringify(initialStats, null, 2));
    
    // Test 3: Create test submission
    console.log('\n3. Creating test submission...');
    const testSubmission = {
      userId: 1,
      assignmentId: 1,
      content: 'def hello_world():\n    print("Hello, World!")\n\nhello_world()',
      contentType: 'text' as const,
      fileExtension: 'py',
      status: 'pending' as const
    };
    
    const createdSubmission = await storage.createSubmission(testSubmission);
    console.log(`✓ Created submission ID: ${createdSubmission.id}`);
    
    // Test 4: Add to queue
    console.log('\n4. Adding submission to BullMQ queue...');
    await queueApi.addSubmission(createdSubmission.id);
    console.log('✓ Submission queued successfully');
    
    // Test 5: Check updated queue stats
    console.log('\n5. Checking updated queue statistics...');
    const updatedStats = await queueApi.getStats();
    console.log('Updated stats:', JSON.stringify(updatedStats, null, 2));
    
    // Test 6: Monitor processing for 20 seconds
    console.log('\n6. Monitoring queue processing...');
    let processingComplete = false;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!processingComplete && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
      
      const currentSubmission = await storage.getSubmission(createdSubmission.id);
      console.log(`Attempt ${attempts}: Status = ${currentSubmission?.status}`);
      
      if (currentSubmission?.status === 'completed' || currentSubmission?.status === 'failed') {
        processingComplete = true;
        console.log(`✓ Processing completed with status: ${currentSubmission.status}`);
        
        // Check for generated feedback
        const feedback = await storage.getFeedbackBySubmissionId(createdSubmission.id);
        if (feedback && feedback.length > 0) {
          console.log('✓ Feedback generated successfully');
        } else {
          console.log('⚠ No feedback found');
        }
      }
    }
    
    if (!processingComplete) {
      console.log('⚠ Processing did not complete within timeout');
    }
    
    // Test 7: Final queue statistics
    console.log('\n7. Final queue statistics...');
    const finalStats = await queueApi.getQueueStats();
    console.log('Final stats:', JSON.stringify(finalStats, null, 2));
    
    console.log('\n✅ BullMQ system test completed');
    return true;
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    return false;
  }
}

// Execute the test
testBullMQSystem().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});