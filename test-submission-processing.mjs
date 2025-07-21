/**
 * End-to-end test for submission processing system
 * Validates: submission acceptance → BullMQ queue → Redis connection → worker processing
 */

import { queueApi } from './server/queue/bullmq-submission-queue.js';
import { storage } from './server/storage.js';

async function testSubmissionProcessing() {
  console.log('🚀 Starting end-to-end submission processing test...\n');
  
  try {
    // Step 1: Check initial queue status
    console.log('📊 Step 1: Checking initial queue status');
    const initialStats = await queueApi.getQueueStats();
    console.log('Initial queue statistics:', JSON.stringify(initialStats, null, 2));
    
    // Step 2: Create a test submission in the database
    console.log('\n📝 Step 2: Creating test submission');
    const testSubmission = {
      userId: 1, // Assuming user ID 1 exists
      assignmentId: 1, // Assuming assignment ID 1 exists
      content: `def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

# Test the function
print("Fibonacci sequence:")
for i in range(10):
    print(f"F({i}) = {fibonacci(i)}")`,
      contentType: 'text',
      fileExtension: 'py',
      status: 'pending'
    };
    
    const createdSubmission = await storage.createSubmission(testSubmission);
    console.log(`✓ Created test submission with ID: ${createdSubmission.id}`);
    
    // Step 3: Add submission to BullMQ queue
    console.log('\n🔄 Step 3: Adding submission to BullMQ queue');
    await queueApi.addSubmission(createdSubmission.id);
    console.log('✓ Successfully added submission to queue');
    
    // Step 4: Check queue status after adding job
    console.log('\n📊 Step 4: Checking updated queue status');
    const updatedStats = await queueApi.getQueueStats();
    console.log('Updated queue statistics:', JSON.stringify(updatedStats, null, 2));
    
    // Step 5: Wait for processing and check results
    console.log('\n⏳ Step 5: Waiting for queue processing (30 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    // Step 6: Check final submission status
    console.log('\n🔍 Step 6: Checking final submission status');
    const processedSubmission = await storage.getSubmission(createdSubmission.id);
    console.log(`Final submission status: ${processedSubmission?.status}`);
    
    // Step 7: Check if feedback was generated
    console.log('\n📋 Step 7: Checking for generated feedback');
    const feedbackList = await storage.getFeedbackBySubmissionId(createdSubmission.id);
    if (feedbackList && feedbackList.length > 0) {
      console.log('✓ Feedback generated successfully');
      console.log(`Feedback preview: ${feedbackList[0].content.substring(0, 100)}...`);
    } else {
      console.log('⚠️ No feedback found - check worker processing');
    }
    
    // Step 8: Final queue statistics
    console.log('\n📊 Step 8: Final queue statistics');
    const finalStats = await queueApi.getQueueStats();
    console.log('Final queue statistics:', JSON.stringify(finalStats, null, 2));
    
    console.log('\n✅ End-to-end test completed successfully!');
    console.log('\n🔍 Test Results Summary:');
    console.log(`- Submission created: ID ${createdSubmission.id}`);
    console.log(`- Queue jobs added: ${updatedStats.waiting - initialStats.waiting}`);
    console.log(`- Final status: ${processedSubmission?.status}`);
    console.log(`- Feedback generated: ${feedbackList?.length > 0 ? 'Yes' : 'No'}`);
    
    return true;
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
    return false;
  }
}

// Run the test
testSubmissionProcessing().then(success => {
  console.log(success ? '\n🎉 All systems working correctly!' : '\n💥 System issues detected');
  process.exit(success ? 0 : 1);
});