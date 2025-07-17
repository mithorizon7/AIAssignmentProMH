import { AssignmentStatusService } from './server/services/assignment-status-service.js';

// Test the automated status calculation
function testStatusCalculation() {
  console.log('Testing Assignment Status Calculation\n');
  
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
  const tomorrow = new Date(now.getTime() + (24 * 60 * 60 * 1000));
  const oneWeekFromNow = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
  const twoWeeksFromNow = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000));
  
  const testCases = [
    { dueDate: oneWeekAgo, expectedStatus: 'completed', description: 'Assignment due 1 week ago' },
    { dueDate: tomorrow, expectedStatus: 'active', description: 'Assignment due tomorrow' },
    { dueDate: oneWeekFromNow, expectedStatus: 'active', description: 'Assignment due in 1 week' },
    { dueDate: twoWeeksFromNow, expectedStatus: 'upcoming', description: 'Assignment due in 2 weeks' }
  ];
  
  testCases.forEach((testCase, index) => {
    const calculatedStatus = AssignmentStatusService.calculateStatusByDate(testCase.dueDate);
    const passed = calculatedStatus === testCase.expectedStatus;
    
    console.log(`Test ${index + 1}: ${testCase.description}`);
    console.log(`  Due Date: ${testCase.dueDate.toLocaleDateString()}`);
    console.log(`  Expected: ${testCase.expectedStatus}`);
    console.log(`  Calculated: ${calculatedStatus}`);
    console.log(`  Result: ${passed ? '✅ PASS' : '❌ FAIL'}\n`);
  });
}

// Test effective status logic
function testEffectiveStatus() {
  console.log('Testing Effective Status Logic\n');
  
  const now = new Date();
  const tomorrow = new Date(now.getTime() + (24 * 60 * 60 * 1000));
  const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000));
  
  const testCases = [
    {
      assignment: { status: 'active', dueDate: tomorrow },
      preferAutomated: true,
      expectedStatus: 'active',
      description: 'Active assignment due tomorrow, prefer automated'
    },
    {
      assignment: { status: 'upcoming', dueDate: tomorrow },
      preferAutomated: true,
      expectedStatus: 'active',
      description: 'Upcoming assignment due tomorrow, prefer automated (should be active)'
    },
    {
      assignment: { status: 'upcoming', dueDate: tomorrow },
      preferAutomated: false,
      expectedStatus: 'upcoming',
      description: 'Upcoming assignment due tomorrow, prefer manual'
    },
    {
      assignment: { status: 'completed', dueDate: yesterday },
      preferAutomated: false,
      expectedStatus: 'completed',
      description: 'Completed assignment past due, prefer manual (reasonable)'
    }
  ];
  
  testCases.forEach((testCase, index) => {
    const effectiveStatus = AssignmentStatusService.getEffectiveStatus(
      testCase.assignment, 
      testCase.preferAutomated
    );
    const passed = effectiveStatus === testCase.expectedStatus;
    
    console.log(`Test ${index + 1}: ${testCase.description}`);
    console.log(`  Manual Status: ${testCase.assignment.status}`);
    console.log(`  Due Date: ${testCase.assignment.dueDate.toLocaleDateString()}`);
    console.log(`  Prefer Automated: ${testCase.preferAutomated}`);
    console.log(`  Expected: ${testCase.expectedStatus}`);
    console.log(`  Effective: ${effectiveStatus}`);
    console.log(`  Result: ${passed ? '✅ PASS' : '❌ FAIL'}\n`);
  });
}

// Run tests
try {
  testStatusCalculation();
  testEffectiveStatus();
  console.log('All tests completed! ✅');
} catch (error) {
  console.error('Test error:', error);
}