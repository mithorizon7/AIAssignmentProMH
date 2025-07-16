/**
 * Comprehensive AI Feedback Test Suite
 * 
 * End-to-end integration tests covering the complete AI feedback pipeline
 * from instructor setup through student submissions to final feedback delivery.
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { apiRequest } from '@/lib/queryClient';

describe('Comprehensive AI Feedback Integration Tests', () => {
  
  const testEnvironment = {
    instructor: {
      id: 'comprehensive-instructor',
      name: 'Dr. Test Instructor',
      email: 'instructor@comprehensive-test.edu'
    },
    students: [
      { id: 'comp-student-1', name: 'Alice Johnson', email: 'alice@test.edu' },
      { id: 'comp-student-2', name: 'Bob Smith', email: 'bob@test.edu' },
      { id: 'comp-student-3', name: 'Carol Davis', email: 'carol@test.edu' }
    ],
    course: {
      id: 'comprehensive-course',
      name: 'Advanced Programming Concepts',
      code: 'CS301'
    },
    assignments: [],
    submissions: []
  };

  beforeAll(async () => {
    console.log('🔧 Setting up comprehensive test environment...');
    
    // Setup complete test environment
    await apiRequest('/api/test-setup/comprehensive', {
      method: 'POST',
      body: JSON.stringify(testEnvironment)
    });
    
    console.log('✅ Comprehensive test environment ready');
  });

  afterAll(async () => {
    console.log('🧹 Cleaning up comprehensive test environment...');
    
    // Cleanup all test data
    await apiRequest('/api/test-cleanup/comprehensive', {
      method: 'POST',
      body: JSON.stringify(testEnvironment)
    });
    
    console.log('✅ Comprehensive test cleanup complete');
  });

  describe('Complete Instructor-to-Student Workflow', () => {
    
    test('should handle full assignment lifecycle with AI feedback', async () => {
      console.log('🎯 Testing complete assignment lifecycle...');
      
      // 1. Instructor creates assignment with detailed rubric
      const assignmentData = {
        title: 'Data Structures Implementation',
        description: 'Implement a binary search tree with insertion, deletion, and traversal methods',
        courseId: testEnvironment.course.id,
        rubric: {
          criteria: [
            {
              name: 'Correctness',
              description: 'Algorithm correctness and edge case handling',
              maxScore: 30,
              weight: 0.3
            },
            {
              name: 'Code Quality',
              description: 'Clean, readable, and well-structured code',
              maxScore: 25,
              weight: 0.25
            },
            {
              name: 'Efficiency',
              description: 'Time and space complexity optimization',
              maxScore: 20,
              weight: 0.2
            },
            {
              name: 'Documentation',
              description: 'Comments, docstrings, and code explanation',
              maxScore: 15,
              weight: 0.15
            },
            {
              name: 'Testing',
              description: 'Test coverage and test case quality',
              maxScore: 10,
              weight: 0.1
            }
          ]
        },
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        allowLateSubmissions: false,
        maxSubmissions: 3
      };

      const assignmentResponse = await apiRequest('/api/assignments', {
        method: 'POST',
        body: JSON.stringify(assignmentData)
      });

      expect(assignmentResponse.success).toBe(true);
      expect(assignmentResponse.assignment).toHaveProperty('id');
      expect(assignmentResponse.assignment.rubric.criteria).toHaveLength(5);
      
      const assignmentId = assignmentResponse.assignment.id;
      testEnvironment.assignments.push(assignmentId);

      // 2. Instructor tests rubric with sample code
      const sampleCode = `
        class TreeNode:
            def __init__(self, val=0, left=None, right=None):
                self.val = val
                self.left = left
                self.right = right

        class BinarySearchTree:
            def __init__(self):
                self.root = None
            
            def insert(self, val):
                """Insert a value into the BST"""
                if not self.root:
                    self.root = TreeNode(val)
                else:
                    self._insert_recursive(self.root, val)
            
            def _insert_recursive(self, node, val):
                if val < node.val:
                    if node.left is None:
                        node.left = TreeNode(val)
                    else:
                        self._insert_recursive(node.left, val)
                else:
                    if node.right is None:
                        node.right = TreeNode(val)
                    else:
                        self._insert_recursive(node.right, val)
            
            def search(self, val):
                """Search for a value in the BST"""
                return self._search_recursive(self.root, val)
            
            def _search_recursive(self, node, val):
                if not node or node.val == val:
                    return node
                if val < node.val:
                    return self._search_recursive(node.left, val)
                return self._search_recursive(node.right, val)
      `;

      const rubricTestResponse = await apiRequest('/api/test-rubric', {
        method: 'POST',
        body: JSON.stringify({
          assignmentId,
          testContent: {
            type: 'text',
            content: sampleCode
          }
        })
      });

      expect(rubricTestResponse.success).toBe(true);
      expect(rubricTestResponse.feedback).toHaveProperty('overallScore');
      expect(rubricTestResponse.feedback.criteriaScores).toHaveLength(5);
      expect(rubricTestResponse.feedback.overallScore).toBeGreaterThan(60); // Should get decent score

      // 3. Students discover and access assignment
      for (const student of testEnvironment.students) {
        const assignmentsResponse = await apiRequest(`/api/students/${student.id}/assignments?courseId=${testEnvironment.course.id}`);
        
        expect(assignmentsResponse.assignments).toBeInstanceOf(Array);
        const foundAssignment = assignmentsResponse.assignments.find(a => a.id === assignmentId);
        expect(foundAssignment).toBeTruthy();
        expect(foundAssignment.title).toBe('Data Structures Implementation');
      }

      // 4. Students submit different quality solutions
      const studentSubmissions = [
        {
          studentId: testEnvironment.students[0].id,
          content: `
            # Excellent implementation with comprehensive testing
            class TreeNode:
                def __init__(self, val=0, left=None, right=None):
                    self.val = val
                    self.left = left
                    self.right = right

            class BinarySearchTree:
                def __init__(self):
                    self.root = None
                
                def insert(self, val):
                    """Insert a value into the BST maintaining BST property"""
                    if not self.root:
                        self.root = TreeNode(val)
                    else:
                        self._insert_recursive(self.root, val)
                
                def _insert_recursive(self, node, val):
                    if val < node.val:
                        if node.left is None:
                            node.left = TreeNode(val)
                        else:
                            self._insert_recursive(node.left, val)
                    elif val > node.val:
                        if node.right is None:
                            node.right = TreeNode(val)
                        else:
                            self._insert_recursive(node.right, val)
                
                def delete(self, val):
                    """Delete a value from the BST"""
                    self.root = self._delete_recursive(self.root, val)
                
                def _delete_recursive(self, node, val):
                    if not node:
                        return node
                    
                    if val < node.val:
                        node.left = self._delete_recursive(node.left, val)
                    elif val > node.val:
                        node.right = self._delete_recursive(node.right, val)
                    else:
                        if not node.left:
                            return node.right
                        elif not node.right:
                            return node.left
                        
                        temp = self._find_min(node.right)
                        node.val = temp.val
                        node.right = self._delete_recursive(node.right, temp.val)
                    
                    return node
                
                def _find_min(self, node):
                    while node.left:
                        node = node.left
                    return node
                
                def inorder_traversal(self):
                    """Return inorder traversal of the BST"""
                    result = []
                    self._inorder_recursive(self.root, result)
                    return result
                
                def _inorder_recursive(self, node, result):
                    if node:
                        self._inorder_recursive(node.left, result)
                        result.append(node.val)
                        self._inorder_recursive(node.right, result)

            # Comprehensive test cases
            def test_bst():
                bst = BinarySearchTree()
                
                # Test insertions
                values = [50, 30, 70, 20, 40, 60, 80]
                for val in values:
                    bst.insert(val)
                
                # Test traversal
                assert bst.inorder_traversal() == [20, 30, 40, 50, 60, 70, 80]
                
                # Test deletion
                bst.delete(20)
                assert bst.inorder_traversal() == [30, 40, 50, 60, 70, 80]
                
                print("All tests passed!")

            if __name__ == "__main__":
                test_bst()
          `,
          expectedScore: 85
        },
        {
          studentId: testEnvironment.students[1].id,
          content: `
            # Good implementation but missing some features
            class TreeNode:
                def __init__(self, val):
                    self.val = val
                    self.left = None
                    self.right = None

            class BinarySearchTree:
                def __init__(self):
                    self.root = None
                
                def insert(self, val):
                    if self.root is None:
                        self.root = TreeNode(val)
                    else:
                        self._insert(self.root, val)
                
                def _insert(self, node, val):
                    if val < node.val:
                        if node.left is None:
                            node.left = TreeNode(val)
                        else:
                            self._insert(node.left, val)
                    else:
                        if node.right is None:
                            node.right = TreeNode(val)
                        else:
                            self._insert(node.right, val)
                
                def search(self, val):
                    return self._search(self.root, val)
                
                def _search(self, node, val):
                    if node is None or node.val == val:
                        return node
                    if val < node.val:
                        return self._search(node.left, val)
                    return self._search(node.right, val)
                
                def inorder(self):
                    result = []
                    self._inorder(self.root, result)
                    return result
                
                def _inorder(self, node, result):
                    if node:
                        self._inorder(node.left, result)
                        result.append(node.val)
                        self._inorder(node.right, result)

            # Basic testing
            bst = BinarySearchTree()
            bst.insert(10)
            bst.insert(5)
            bst.insert(15)
            print(bst.inorder())
          `,
          expectedScore: 65
        },
        {
          studentId: testEnvironment.students[2].id,
          content: `
            # Basic implementation with issues
            class Node:
                def __init__(self, data):
                    self.data = data
                    self.left = None
                    self.right = None

            class BST:
                def __init__(self):
                    self.root = None
                
                def add(self, data):
                    if self.root == None:
                        self.root = Node(data)
                    else:
                        self.addNode(self.root, data)
                
                def addNode(self, node, data):
                    if data < node.data:
                        if node.left == None:
                            node.left = Node(data)
                        else:
                            self.addNode(node.left, data)
                    else:
                        if node.right == None:
                            node.right = Node(data)
                        else:
                            self.addNode(node.right, data)

            tree = BST()
            tree.add(1)
            tree.add(2)
            tree.add(3)
          `,
          expectedScore: 40
        }
      ];

      // Submit all student solutions
      for (const submission of studentSubmissions) {
        const submissionResponse = await apiRequest('/api/submissions', {
          method: 'POST',
          body: JSON.stringify({
            assignmentId,
            studentId: submission.studentId,
            content: submission.content,
            submissionType: 'text'
          })
        });

        expect(submissionResponse.success).toBe(true);
        testEnvironment.submissions.push(submissionResponse.submission.id);
      }

      // 5. Wait for AI processing to complete
      console.log('⏳ Waiting for AI processing...');
      await new Promise(resolve => setTimeout(resolve, 15000)); // 15 seconds

      // 6. Verify AI feedback generation
      for (let i = 0; i < studentSubmissions.length; i++) {
        const submissionId = testEnvironment.submissions[i];
        const feedbackResponse = await apiRequest(`/api/submissions/${submissionId}/feedback`);
        
        expect(feedbackResponse.feedback).toBeTruthy();
        expect(feedbackResponse.feedback).toHaveProperty('overallScore');
        expect(feedbackResponse.feedback).toHaveProperty('criteriaScores');
        expect(feedbackResponse.feedback.criteriaScores).toHaveLength(5);
        
        // Verify feedback quality correlates with submission quality
        const actualScore = feedbackResponse.feedback.overallScore;
        const expectedScore = studentSubmissions[i].expectedScore;
        
        // Allow 20 point variance in scoring
        expect(Math.abs(actualScore - expectedScore)).toBeLessThan(20);
        
        console.log(`Student ${i + 1}: Expected ${expectedScore}, Got ${actualScore}`);
      }

      // 7. Students interact with feedback
      for (const submissionId of testEnvironment.submissions) {
        // Mark feedback as read
        const readResponse = await apiRequest(`/api/submissions/${submissionId}/feedback/read`, {
          method: 'POST'
        });
        expect(readResponse.success).toBe(true);

        // Request clarification
        const clarificationResponse = await apiRequest('/api/feedback/clarification', {
          method: 'POST',
          body: JSON.stringify({
            submissionId,
            question: 'Could you explain how to improve the code quality score?',
            criteriaName: 'Code Quality'
          })
        });
        
        if (clarificationResponse.success) {
          expect(clarificationResponse.clarification.response).toBeTruthy();
        }
      }

      // 8. Instructor reviews results and analytics
      const analyticsResponse = await apiRequest(`/api/assignments/${assignmentId}/analytics`);
      
      expect(analyticsResponse.analytics).toHaveProperty('totalSubmissions');
      expect(analyticsResponse.analytics).toHaveProperty('averageScore');
      expect(analyticsResponse.analytics).toHaveProperty('scoreDistribution');
      expect(analyticsResponse.analytics.totalSubmissions).toBe(3);

      console.log('✅ Complete assignment lifecycle test passed');
    }, 120000); // 2 minute timeout

    test('should handle multimodal submissions with images and documents', async () => {
      console.log('🎯 Testing multimodal submission workflow...');
      
      // Create multimodal assignment
      const assignmentData = {
        title: 'Algorithm Visualization Project',
        description: 'Create a sorting algorithm visualization with code and diagrams',
        courseId: testEnvironment.course.id,
        rubric: {
          criteria: [
            { name: 'Algorithm Implementation', description: 'Code correctness', maxScore: 40, weight: 0.4 },
            { name: 'Visualization Quality', description: 'Diagram clarity', maxScore: 30, weight: 0.3 },
            { name: 'Documentation', description: 'Explanations', maxScore: 30, weight: 0.3 }
          ]
        },
        allowedFileTypes: ['image/png', 'image/jpeg', 'application/pdf', 'text/plain'],
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      const assignmentResponse = await apiRequest('/api/assignments', {
        method: 'POST',
        body: JSON.stringify(assignmentData)
      });

      expect(assignmentResponse.success).toBe(true);
      const assignmentId = assignmentResponse.assignment.id;

      // Submit multimodal content
      const multimodalSubmission = {
        assignmentId,
        studentId: testEnvironment.students[0].id,
        content: 'Please see my bubble sort implementation with visual explanation.',
        submissionType: 'multimodal',
        attachments: [
          {
            type: 'text',
            content: `
              def bubble_sort(arr):
                  """
                  Bubble sort implementation with detailed comments
                  Time complexity: O(n²)
                  Space complexity: O(1)
                  """
                  n = len(arr)
                  for i in range(n):
                      for j in range(0, n - i - 1):
                          if arr[j] > arr[j + 1]:
                              arr[j], arr[j + 1] = arr[j + 1], arr[j]
                  return arr
            `
          },
          {
            type: 'image',
            mimeType: 'image/png',
            content: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
          }
        ]
      };

      const submissionResponse = await apiRequest('/api/submissions', {
        method: 'POST',
        body: JSON.stringify(multimodalSubmission)
      });

      expect(submissionResponse.success).toBe(true);
      expect(submissionResponse.submission.submissionType).toBe('multimodal');

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Verify multimodal feedback
      const feedbackResponse = await apiRequest(`/api/submissions/${submissionResponse.submission.id}/feedback`);
      
      expect(feedbackResponse.feedback).toBeTruthy();
      expect(feedbackResponse.feedback.overallFeedback).toContain('algorithm');
      expect(feedbackResponse.feedback.criteriaScores).toHaveLength(3);

      console.log('✅ Multimodal submission test passed');
    }, 90000); // 1.5 minute timeout
  });

  describe('System Resilience and Error Recovery', () => {
    
    test('should handle high concurrent load gracefully', async () => {
      console.log('🎯 Testing concurrent load handling...');
      
      // Create load test assignment
      const assignmentResponse = await apiRequest('/api/assignments', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Load Test Assignment',
          courseId: testEnvironment.course.id,
          rubric: {
            criteria: [
              { name: 'Performance', description: 'Code performance', maxScore: 100, weight: 1.0 }
            ]
          }
        })
      });

      const assignmentId = assignmentResponse.assignment.id;

      // Submit many concurrent submissions
      const concurrentSubmissions = Array.from({ length: 10 }, (_, i) =>
        apiRequest('/api/submissions', {
          method: 'POST',
          body: JSON.stringify({
            assignmentId,
            studentId: testEnvironment.students[i % testEnvironment.students.length].id,
            content: `function loadTest${i}() { return "concurrent test ${i}"; }`,
            submissionType: 'text'
          })
        })
      );

      const results = await Promise.allSettled(concurrentSubmissions);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      // Most submissions should succeed
      expect(successful).toBeGreaterThan(7);
      expect(failed).toBeLessThan(3);

      console.log(`Concurrent load test: ${successful} successful, ${failed} failed`);
      console.log('✅ Concurrent load test passed');
    });

    test('should maintain data consistency under stress', async () => {
      console.log('🎯 Testing data consistency under stress...');
      
      const studentId = testEnvironment.students[0].id;
      const assignmentId = testEnvironment.assignments[0];

      // Perform concurrent operations on same student
      const concurrentOps = [
        apiRequest(`/api/students/${studentId}/submissions`),
        apiRequest(`/api/students/${studentId}/analytics`),
        apiRequest('/api/submissions', {
          method: 'POST',
          body: JSON.stringify({
            assignmentId,
            studentId,
            content: 'function consistencyTest() { return "test"; }',
            submissionType: 'text'
          })
        }),
        apiRequest(`/api/students/${studentId}/assignments`)
      ];

      const results = await Promise.allSettled(concurrentOps);
      
      // All operations should complete without corruption
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.log(`Operation ${index} failed:`, result.reason);
        }
        expect(result.status).toBe('fulfilled');
      });

      console.log('✅ Data consistency test passed');
    });
  });

  describe('Performance and Quality Metrics', () => {
    
    test('should meet performance benchmarks', async () => {
      console.log('🎯 Testing performance benchmarks...');
      
      const assignmentId = testEnvironment.assignments[0];
      const studentId = testEnvironment.students[0].id;

      // Test API response times
      const performanceTests = [
        {
          name: 'Assignment details retrieval',
          operation: () => apiRequest(`/api/assignments/${assignmentId}/details`),
          maxTime: 2000 // 2 seconds
        },
        {
          name: 'Student submissions list',
          operation: () => apiRequest(`/api/students/${studentId}/submissions`),
          maxTime: 3000 // 3 seconds
        },
        {
          name: 'Assignment analytics',
          operation: () => apiRequest(`/api/assignments/${assignmentId}/analytics`),
          maxTime: 5000 // 5 seconds
        }
      ];

      for (const test of performanceTests) {
        const startTime = Date.now();
        const result = await test.operation();
        const duration = Date.now() - startTime;

        expect(result).toBeTruthy();
        expect(duration).toBeLessThan(test.maxTime);

        console.log(`${test.name}: ${duration}ms (target: <${test.maxTime}ms)`);
      }

      console.log('✅ Performance benchmarks test passed');
    });

    test('should validate AI feedback quality', async () => {
      console.log('🎯 Testing AI feedback quality...');
      
      if (testEnvironment.submissions.length === 0) {
        console.log('⏭️ Skipping feedback quality test - no submissions available');
        return;
      }

      const submissionId = testEnvironment.submissions[0];
      const feedbackResponse = await apiRequest(`/api/submissions/${submissionId}/feedback`);
      
      if (!feedbackResponse.feedback) {
        console.log('⏭️ Skipping feedback quality test - no feedback available');
        return;
      }

      const feedback = feedbackResponse.feedback;

      // Validate feedback structure
      expect(feedback).toHaveProperty('overallScore');
      expect(feedback).toHaveProperty('overallFeedback');
      expect(feedback).toHaveProperty('criteriaScores');

      // Validate score ranges
      expect(feedback.overallScore).toBeGreaterThanOrEqual(0);
      expect(feedback.overallScore).toBeLessThanOrEqual(100);

      // Validate feedback quality
      expect(feedback.overallFeedback.length).toBeGreaterThan(20); // Substantial feedback
      expect(feedback.criteriaScores.length).toBeGreaterThan(0);

      // Validate criteria feedback
      feedback.criteriaScores.forEach(criteria => {
        expect(criteria.score).toBeGreaterThanOrEqual(0);
        expect(criteria.score).toBeLessThanOrEqual(criteria.maxScore || 100);
        expect(criteria.feedback.length).toBeGreaterThan(5); // Meaningful feedback
      });

      console.log(`Feedback quality: ${feedback.overallFeedback.length} chars, ${feedback.criteriaScores.length} criteria`);
      console.log('✅ AI feedback quality test passed');
    });
  });

  describe('End-to-End User Experience', () => {
    
    test('should provide seamless instructor experience', async () => {
      console.log('🎯 Testing instructor user experience...');
      
      const instructorId = testEnvironment.instructor.id;
      
      // Instructor dashboard access
      const dashboardResponse = await apiRequest(`/api/instructors/${instructorId}/dashboard`);
      expect(dashboardResponse.dashboard).toBeTruthy();

      // Course management
      const coursesResponse = await apiRequest(`/api/instructors/${instructorId}/courses`);
      expect(coursesResponse.courses).toBeInstanceOf(Array);

      // Assignment overview
      if (testEnvironment.assignments.length > 0) {
        const assignmentId = testEnvironment.assignments[0];
        const overviewResponse = await apiRequest(`/api/assignments/${assignmentId}/overview`);
        expect(overviewResponse.overview).toBeTruthy();
      }

      console.log('✅ Instructor experience test passed');
    });

    test('should provide seamless student experience', async () => {
      console.log('🎯 Testing student user experience...');
      
      const studentId = testEnvironment.students[0].id;
      
      // Student dashboard
      const dashboardResponse = await apiRequest(`/api/students/${studentId}/dashboard`);
      expect(dashboardResponse.dashboard).toBeTruthy();

      // Available assignments
      const assignmentsResponse = await apiRequest(`/api/students/${studentId}/assignments`);
      expect(assignmentsResponse.assignments).toBeInstanceOf(Array);

      // Submission history
      const historyResponse = await apiRequest(`/api/students/${studentId}/submission-history`);
      expect(historyResponse.history).toBeInstanceOf(Array);

      // Progress tracking
      const progressResponse = await apiRequest(`/api/students/${studentId}/progress`);
      expect(progressResponse.progress).toBeTruthy();

      console.log('✅ Student experience test passed');
    });

    test('should maintain system health throughout workflows', async () => {
      console.log('🎯 Testing system health monitoring...');
      
      // System health check
      const healthResponse = await apiRequest('/api/health');
      expect(healthResponse.status).toBe('healthy');
      expect(healthResponse.checks).toBeTruthy();

      // Queue health
      const queueResponse = await apiRequest('/api/queue/status');
      expect(queueResponse.status).toBeTruthy();

      // Database health
      const dbResponse = await apiRequest('/api/system/database-status');
      expect(dbResponse.connected).toBe(true);

      // AI service health
      const aiResponse = await apiRequest('/api/ai/health');
      expect(aiResponse.status).toBeTruthy();

      console.log('✅ System health test passed');
    });
  });
});