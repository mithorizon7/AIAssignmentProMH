/**
 * Student Workflow Tests
 * 
 * End-to-end tests for student-specific AI feedback workflows,
 * including submission creation, feedback retrieval, and interaction.
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { apiRequest } from '@/lib/queryClient';

describe('Student Workflow Tests', () => {
  
  const studentId = 'test-student-workflow';
  const instructorId = 'test-instructor-for-student';
  const courseId = 'test-course-for-student';
  let assignmentId: string;

  beforeAll(async () => {
    // Setup test environment
    await apiRequest('/api/test-setup/student-workflow', {
      method: 'POST',
      body: JSON.stringify({
        studentId,
        instructorId,
        courseId,
        courseName: 'Student Workflow Test Course'
      })
    });

    // Create a test assignment
    const assignmentResponse = await apiRequest('/api/assignments', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Student Test Assignment',
        description: 'Assignment for testing student workflows',
        courseId,
        rubric: {
          criteria: [
            { name: 'Correctness', description: 'Code works as expected', maxScore: 40, weight: 0.4 },
            { name: 'Style', description: 'Code follows best practices', maxScore: 30, weight: 0.3 },
            { name: 'Documentation', description: 'Code is well documented', maxScore: 30, weight: 0.3 }
          ]
        },
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      })
    });

    assignmentId = assignmentResponse.assignment.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await apiRequest('/api/test-cleanup/student-workflow', {
      method: 'POST',
      body: JSON.stringify({ studentId, instructorId, courseId })
    });
  });

  describe('Assignment Discovery and Access', () => {
    
    test('should retrieve available assignments for student', async () => {
      const response = await apiRequest(`/api/students/${studentId}/assignments?courseId=${courseId}`);
      
      expect(response.assignments).toBeInstanceOf(Array);
      expect(response.assignments.length).toBeGreaterThan(0);
      
      const assignment = response.assignments.find(a => a.id === assignmentId);
      expect(assignment).toBeTruthy();
      expect(assignment.title).toBe('Student Test Assignment');
      expect(assignment.rubric.criteria).toHaveLength(3);
    });

    test('should show assignment details and requirements', async () => {
      const response = await apiRequest(`/api/assignments/${assignmentId}/details`);
      
      expect(response.assignment).toHaveProperty('title');
      expect(response.assignment).toHaveProperty('description');
      expect(response.assignment).toHaveProperty('dueDate');
      expect(response.assignment).toHaveProperty('rubric');
      expect(response.assignment.rubric.criteria).toHaveLength(3);
    });

    test('should check submission status for assignment', async () => {
      const response = await apiRequest(`/api/students/${studentId}/assignments/${assignmentId}/status`);
      
      expect(response.status).toHaveProperty('hasSubmitted');
      expect(response.status).toHaveProperty('submissionCount');
      expect(response.status).toHaveProperty('lastSubmission');
      expect(response.status).toHaveProperty('feedbackAvailable');
    });
  });

  describe('Text-Based Submissions', () => {
    
    test('should submit text-based code assignment', async () => {
      const submissionData = {
        assignmentId,
        studentId,
        content: `
          // Bubble sort implementation
          function bubbleSort(arr) {
            const n = arr.length;
            
            for (let i = 0; i < n - 1; i++) {
              for (let j = 0; j < n - i - 1; j++) {
                if (arr[j] > arr[j + 1]) {
                  // Swap elements
                  [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
                }
              }
            }
            
            return arr;
          }
          
          // Test the function
          const testArray = [64, 34, 25, 12, 22, 11, 90];
          console.log("Original array:", testArray);
          console.log("Sorted array:", bubbleSort([...testArray]));
        `,
        submissionType: 'text'
      };

      const response = await apiRequest('/api/submissions', {
        method: 'POST',
        body: JSON.stringify(submissionData)
      });

      expect(response.success).toBe(true);
      expect(response.submission).toHaveProperty('id');
      expect(response.submission.status).toBe('pending');
      expect(response.submission.submissionType).toBe('text');
    });

    test('should handle multiple text submissions for same assignment', async () => {
      const submissions = [];
      
      for (let i = 1; i <= 3; i++) {
        const submissionData = {
          assignmentId,
          studentId,
          content: `
            // Version ${i} of my solution
            function solution${i}() {
              console.log("This is version ${i}");
              return ${i};
            }
          `,
          submissionType: 'text'
        };

        const response = await apiRequest('/api/submissions', {
          method: 'POST',
          body: JSON.stringify(submissionData)
        });

        expect(response.success).toBe(true);
        submissions.push(response.submission);
      }

      expect(submissions).toHaveLength(3);
      submissions.forEach((submission, index) => {
        expect(submission.content).toContain(`Version ${index + 1}`);
      });
    });

    test('should validate submission content length limits', async () => {
      const largeContent = 'console.log("test");'.repeat(10000); // Very large submission
      
      const submissionData = {
        assignmentId,
        studentId,
        content: largeContent,
        submissionType: 'text'
      };

      const response = await apiRequest('/api/submissions', {
        method: 'POST',
        body: JSON.stringify(submissionData)
      });

      // Should either accept or gracefully reject with size limit message
      if (!response.success) {
        expect(response.error).toMatch(/(size|limit|large)/i);
      } else {
        expect(response.submission.status).toBe('pending');
      }
    });
  });

  describe('File Upload Submissions', () => {
    
    test('should submit JavaScript file', async () => {
      const fileContent = `
        /**
         * Quick sort implementation
         * @param {number[]} arr - Array to sort
         * @returns {number[]} Sorted array
         */
        function quickSort(arr) {
          if (arr.length <= 1) return arr;
          
          const pivot = arr[Math.floor(arr.length / 2)];
          const left = arr.filter(x => x < pivot);
          const middle = arr.filter(x => x === pivot);
          const right = arr.filter(x => x > pivot);
          
          return [...quickSort(left), ...middle, ...quickSort(right)];
        }
        
        module.exports = quickSort;
      `;

      const formData = new FormData();
      formData.append('file', new Blob([fileContent], { type: 'text/javascript' }), 'quicksort.js');
      formData.append('assignmentId', assignmentId);
      formData.append('studentId', studentId);

      const response = await fetch('/api/submissions/upload', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.submission.submissionType).toBe('file');
      expect(result.submission.fileName).toBe('quicksort.js');
    });

    test('should submit Python file', async () => {
      const pythonContent = `
        def merge_sort(arr):
            """
            Merge sort implementation
            Args:
                arr: List of numbers to sort
            Returns:
                Sorted list
            """
            if len(arr) <= 1:
                return arr
            
            mid = len(arr) // 2
            left = merge_sort(arr[:mid])
            right = merge_sort(arr[mid:])
            
            return merge(left, right)
        
        def merge(left, right):
            result = []
            i = j = 0
            
            while i < len(left) and j < len(right):
                if left[i] <= right[j]:
                    result.append(left[i])
                    i += 1
                else:
                    result.append(right[j])
                    j += 1
            
            result.extend(left[i:])
            result.extend(right[j:])
            return result
        
        # Test the function
        if __name__ == "__main__":
            test_array = [64, 34, 25, 12, 22, 11, 90]
            print("Original:", test_array)
            print("Sorted:", merge_sort(test_array))
      `;

      const formData = new FormData();
      formData.append('file', new Blob([pythonContent], { type: 'text/x-python' }), 'mergesort.py');
      formData.append('assignmentId', assignmentId);
      formData.append('studentId', studentId);

      const response = await fetch('/api/submissions/upload', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.submission.fileName).toBe('mergesort.py');
    });

    test('should reject invalid file types', async () => {
      const maliciousContent = 'This is not a valid code file';
      
      const formData = new FormData();
      formData.append('file', new Blob([maliciousContent], { type: 'application/x-executable' }), 'malware.exe');
      formData.append('assignmentId', assignmentId);
      formData.append('studentId', studentId);

      const response = await fetch('/api/submissions/upload', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toContain('File type not allowed');
    });

    test('should handle multiple file uploads in single submission', async () => {
      const files = [
        { name: 'main.js', content: 'const helper = require("./helper"); console.log(helper());' },
        { name: 'helper.js', content: 'module.exports = () => "Helper function";' },
        { name: 'README.md', content: '# My Project\nThis is my submission with multiple files.' }
      ];

      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', new Blob([file.content], { type: 'text/plain' }), file.name);
      });
      formData.append('assignmentId', assignmentId);
      formData.append('studentId', studentId);

      const response = await fetch('/api/submissions/upload-multiple', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.submission.files).toHaveLength(3);
    });
  });

  describe('Multimedia Submissions', () => {
    
    test('should submit image with code explanation', async () => {
      const imageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      
      const submissionData = {
        assignmentId,
        studentId,
        content: 'Please see the attached diagram explaining my algorithm approach.',
        submissionType: 'multimodal',
        attachments: [
          {
            type: 'image',
            mimeType: 'image/png',
            content: imageData
          }
        ]
      };

      const response = await apiRequest('/api/submissions', {
        method: 'POST',
        body: JSON.stringify(submissionData)
      });

      expect(response.success).toBe(true);
      expect(response.submission.submissionType).toBe('multimodal');
      expect(response.submission.attachments).toHaveLength(1);
    });

    test('should submit video explanation', async () => {
      // Simulate video submission
      const formData = new FormData();
      const videoBlob = new Blob(['mock video data'], { type: 'video/mp4' });
      formData.append('video', videoBlob, 'explanation.mp4');
      formData.append('assignmentId', assignmentId);
      formData.append('studentId', studentId);
      formData.append('description', 'Video explanation of my solution');

      const response = await fetch('/api/submissions/video', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      
      if (result.success) {
        expect(result.submission.submissionType).toBe('video');
        expect(result.submission.fileName).toBe('explanation.mp4');
      } else {
        // Video might not be supported, check error message
        expect(result.error).toMatch(/(video|format|support)/i);
      }
    });
  });

  describe('Feedback Retrieval and Interaction', () => {
    
    test('should retrieve feedback for submitted assignment', async () => {
      // First submit something
      const submissionResponse = await apiRequest('/api/submissions', {
        method: 'POST',
        body: JSON.stringify({
          assignmentId,
          studentId,
          content: 'function test() { return "feedback test"; }',
          submissionType: 'text'
        })
      });

      const submissionId = submissionResponse.submission.id;

      // Wait for AI processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Retrieve feedback
      const feedbackResponse = await apiRequest(`/api/submissions/${submissionId}/feedback`);
      
      expect(feedbackResponse.feedback).toBeTruthy();
      expect(feedbackResponse.feedback).toHaveProperty('overallScore');
      expect(feedbackResponse.feedback).toHaveProperty('overallFeedback');
      expect(feedbackResponse.feedback).toHaveProperty('criteriaScores');
      expect(feedbackResponse.feedback.criteriaScores).toHaveLength(3);

      // Validate score ranges
      expect(feedbackResponse.feedback.overallScore).toBeGreaterThanOrEqual(0);
      expect(feedbackResponse.feedback.overallScore).toBeLessThanOrEqual(100);
    });

    test('should track feedback reading status', async () => {
      // Get latest submission
      const submissionsResponse = await apiRequest(`/api/students/${studentId}/submissions?assignmentId=${assignmentId}`);
      const latestSubmission = submissionsResponse.submissions[0];

      // Mark feedback as read
      const readResponse = await apiRequest(`/api/submissions/${latestSubmission.id}/feedback/read`, {
        method: 'POST'
      });

      expect(readResponse.success).toBe(true);

      // Check read status
      const statusResponse = await apiRequest(`/api/submissions/${latestSubmission.id}/feedback/status`);
      expect(statusResponse.status.isRead).toBe(true);
      expect(statusResponse.status.readAt).toBeTruthy();
    });

    test('should allow student to request clarification', async () => {
      const submissionsResponse = await apiRequest(`/api/students/${studentId}/submissions?assignmentId=${assignmentId}`);
      const submission = submissionsResponse.submissions[0];

      const clarificationRequest = {
        submissionId: submission.id,
        question: 'Could you explain why my code quality score was lower?',
        criteriaName: 'Style'
      };

      const response = await apiRequest('/api/feedback/clarification', {
        method: 'POST',
        body: JSON.stringify(clarificationRequest)
      });

      expect(response.success).toBe(true);
      expect(response.clarification).toHaveProperty('id');
      expect(response.clarification).toHaveProperty('response');
      expect(response.clarification.response).toBeTruthy();
    });

    test('should provide submission history and progress tracking', async () => {
      const historyResponse = await apiRequest(`/api/students/${studentId}/submission-history?assignmentId=${assignmentId}`);
      
      expect(historyResponse.history).toBeInstanceOf(Array);
      expect(historyResponse.history.length).toBeGreaterThan(0);
      
      historyResponse.history.forEach(submission => {
        expect(submission).toHaveProperty('id');
        expect(submission).toHaveProperty('submittedAt');
        expect(submission).toHaveProperty('status');
        if (submission.feedback) {
          expect(submission.feedback).toHaveProperty('overallScore');
        }
      });

      // Check progress metrics
      expect(historyResponse.progress).toHaveProperty('totalSubmissions');
      expect(historyResponse.progress).toHaveProperty('averageScore');
      expect(historyResponse.progress).toHaveProperty('improvement');
    });
  });

  describe('Submission Management', () => {
    
    test('should allow submission updates before deadline', async () => {
      // Create initial submission
      const initialResponse = await apiRequest('/api/submissions', {
        method: 'POST',
        body: JSON.stringify({
          assignmentId,
          studentId,
          content: 'function initial() { return "first version"; }',
          submissionType: 'text'
        })
      });

      const submissionId = initialResponse.submission.id;

      // Update submission
      const updateResponse = await apiRequest(`/api/submissions/${submissionId}`, {
        method: 'PUT',
        body: JSON.stringify({
          content: 'function improved() { return "updated version with better implementation"; }'
        })
      });

      expect(updateResponse.success).toBe(true);
      expect(updateResponse.submission.content).toContain('updated version');
    });

    test('should prevent updates after deadline', async () => {
      // Create assignment with past deadline
      const pastAssignmentResponse = await apiRequest('/api/assignments', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Past Deadline Assignment',
          courseId,
          rubric: { criteria: [{ name: 'Test', description: 'Test', maxScore: 100, weight: 1.0 }] },
          dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // Yesterday
        })
      });

      const submissionData = {
        assignmentId: pastAssignmentResponse.assignment.id,
        studentId,
        content: 'function late() { return "too late"; }',
        submissionType: 'text'
      };

      const response = await apiRequest('/api/submissions', {
        method: 'POST',
        body: JSON.stringify(submissionData)
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('deadline');
    });

    test('should handle draft submissions', async () => {
      const draftData = {
        assignmentId,
        studentId,
        content: 'function draft() { /* work in progress */ }',
        submissionType: 'text',
        isDraft: true
      };

      const response = await apiRequest('/api/submissions/draft', {
        method: 'POST',
        body: JSON.stringify(draftData)
      });

      expect(response.success).toBe(true);
      expect(response.draft.status).toBe('draft');

      // Submit draft
      const submitResponse = await apiRequest(`/api/submissions/draft/${response.draft.id}/submit`, {
        method: 'POST'
      });

      expect(submitResponse.success).toBe(true);
      expect(submitResponse.submission.status).toBe('pending');
    });
  });

  describe('Collaboration and Sharing', () => {
    
    test('should generate shareable submission link', async () => {
      const submissionsResponse = await apiRequest(`/api/students/${studentId}/submissions?assignmentId=${assignmentId}`);
      const submission = submissionsResponse.submissions[0];

      const shareResponse = await apiRequest(`/api/submissions/${submission.id}/share`, {
        method: 'POST',
        body: JSON.stringify({
          includeCode: true,
          includeFeedback: false,
          expiresIn: '7d'
        })
      });

      expect(shareResponse.success).toBe(true);
      expect(shareResponse.shareLink).toBeTruthy();
      expect(shareResponse.shareLink).toContain('share');
    });

    test('should access shared submission via anonymous link', async () => {
      // Use the share link from previous test
      const submissionsResponse = await apiRequest(`/api/students/${studentId}/submissions?assignmentId=${assignmentId}`);
      const submission = submissionsResponse.submissions[0];

      const shareResponse = await apiRequest(`/api/submissions/${submission.id}/share`, {
        method: 'POST',
        body: JSON.stringify({ includeCode: true, includeFeedback: true })
      });

      const shareToken = shareResponse.shareLink.split('/').pop();

      // Access shared submission
      const sharedResponse = await apiRequest(`/api/shared/${shareToken}`);
      
      expect(sharedResponse.submission).toBeTruthy();
      expect(sharedResponse.submission.content).toBeTruthy();
    });

    test('should handle peer review assignments', async () => {
      // Create peer review assignment
      const peerAssignmentResponse = await apiRequest('/api/assignments', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Peer Review Assignment',
          courseId,
          rubric: { criteria: [{ name: 'Quality', description: 'Code quality', maxScore: 100, weight: 1.0 }] },
          isPeerReview: true,
          reviewsPerSubmission: 2
        })
      });

      const peerAssignmentId = peerAssignmentResponse.assignment.id;

      // Submit to peer review assignment
      const submissionResponse = await apiRequest('/api/submissions', {
        method: 'POST',
        body: JSON.stringify({
          assignmentId: peerAssignmentId,
          studentId,
          content: 'function peerReview() { return "review this"; }',
          submissionType: 'text'
        })
      });

      expect(submissionResponse.success).toBe(true);

      // Get assignments to review
      const reviewResponse = await apiRequest(`/api/students/${studentId}/peer-reviews?assignmentId=${peerAssignmentId}`);
      
      expect(reviewResponse.reviewAssignments).toBeInstanceOf(Array);
    });
  });

  describe('Performance and User Experience', () => {
    
    test('should handle real-time submission status updates', async () => {
      const submissionResponse = await apiRequest('/api/submissions', {
        method: 'POST',
        body: JSON.stringify({
          assignmentId,
          studentId,
          content: 'function realtime() { return "status tracking"; }',
          submissionType: 'text'
        })
      });

      const submissionId = submissionResponse.submission.id;

      // Poll for status updates
      let attempts = 0;
      let status = 'pending';
      
      while (attempts < 10 && status === 'pending') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await apiRequest(`/api/submissions/${submissionId}/status`);
        status = statusResponse.status;
        attempts++;
      }

      expect(['pending', 'processing', 'completed']).toContain(status);
    });

    test('should provide submission analytics for student', async () => {
      const analyticsResponse = await apiRequest(`/api/students/${studentId}/analytics?courseId=${courseId}`);
      
      expect(analyticsResponse.analytics).toHaveProperty('totalSubmissions');
      expect(analyticsResponse.analytics).toHaveProperty('averageScore');
      expect(analyticsResponse.analytics).toHaveProperty('improvement');
      expect(analyticsResponse.analytics).toHaveProperty('strengthsWeaknesses');
      expect(analyticsResponse.analytics).toHaveProperty('timeToCompletion');
    });

    test('should handle offline submission preparation', async () => {
      // Test offline functionality (if supported)
      const offlineData = {
        assignmentId,
        studentId,
        content: 'function offline() { return "prepared offline"; }',
        submissionType: 'text',
        preparedOffline: true,
        timestamp: new Date().toISOString()
      };

      const response = await apiRequest('/api/submissions/sync', {
        method: 'POST',
        body: JSON.stringify(offlineData)
      });

      // Should either handle sync or provide clear error
      if (response.success) {
        expect(response.submission.status).toBe('pending');
      } else {
        expect(response.error).toContain('sync');
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    
    test('should handle network interruptions during submission', async () => {
      // Simulate large submission that might be interrupted
      const largeSubmission = {
        assignmentId,
        studentId,
        content: 'function large() {\n' + '  console.log("test");\n'.repeat(1000) + '}',
        submissionType: 'text'
      };

      const response = await apiRequest('/api/submissions', {
        method: 'POST',
        body: JSON.stringify(largeSubmission)
      });

      // Should handle gracefully
      expect(response.success).toBe(true);
      expect(response.submission).toHaveProperty('id');
    });

    test('should handle malformed content gracefully', async () => {
      const malformedData = {
        assignmentId,
        studentId,
        content: null, // Invalid content
        submissionType: 'text'
      };

      const response = await apiRequest('/api/submissions', {
        method: 'POST',
        body: JSON.stringify(malformedData)
      });

      expect(response.success).toBe(false);
      expect(response.error).toBeTruthy();
    });

    test('should validate student permissions for assignment access', async () => {
      // Try to access assignment from different course
      const unauthorizedResponse = await apiRequest(`/api/assignments/nonexistent/details`);
      
      expect(unauthorizedResponse.success).toBe(false);
      expect(unauthorizedResponse.error).toContain('not found');
    });
  });
});