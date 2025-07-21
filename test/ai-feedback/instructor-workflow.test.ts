/**
 * Instructor Workflow Tests
 * 
 * End-to-end tests for instructor-specific AI feedback workflows,
 * including rubric creation, testing, and assignment management.
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { apiRequest } from '@/lib/queryClient';

describe('Instructor Workflow Tests', () => {
  
  const instructorId = 'test-instructor-workflow';
  const courseId = 'test-course-workflow';
  let assignmentId: string;

  beforeAll(async () => {
    // Setup test instructor and course
    await apiRequest('/api/test-setup/instructor', {
      method: 'POST',
      body: JSON.stringify({
        instructorId,
        courseId,
        courseName: 'Instructor Workflow Test Course'
      })
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await apiRequest('/api/test-cleanup/instructor', {
      method: 'POST',
      body: JSON.stringify({ instructorId, courseId })
    });
  });

  describe('Assignment Creation and Rubric Management', () => {
    
    test('should create assignment with comprehensive rubric', async () => {
      const assignmentData = {
        title: 'Comprehensive Programming Assignment',
        description: 'Students should submit a well-documented function that solves a specific problem.',
        courseId,
        rubric: {
          criteria: [
            {
              name: 'Code Quality',
              description: 'Code structure, readability, and adherence to best practices',
              maxScore: 25,
              weight: 0.3
            },
            {
              name: 'Functionality',
              description: 'Whether the code produces correct results',
              maxScore: 25,
              weight: 0.4
            },
            {
              name: 'Documentation',
              description: 'Quality of comments and explanations',
              maxScore: 25,
              weight: 0.2
            },
            {
              name: 'Efficiency',
              description: 'Algorithm efficiency and performance considerations',
              maxScore: 25,
              weight: 0.1
            }
          ]
        },
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      const response = await apiRequest('/api/assignments', {
        method: 'POST',
        body: JSON.stringify(assignmentData)
      });

      expect(response.success).toBe(true);
      expect(response.assignment).toHaveProperty('id');
      expect(response.assignment.rubric.criteria).toHaveLength(4);
      
      assignmentId = response.assignment.id;
    });

    test('should validate rubric completeness before saving', async () => {
      const incompleteRubric = {
        title: 'Incomplete Rubric Test',
        courseId,
        rubric: {
          criteria: [
            {
              name: 'Code Quality',
              // Missing description and weight
              maxScore: 25
            }
          ]
        }
      };

      const response = await apiRequest('/api/assignments/validate', {
        method: 'POST',
        body: JSON.stringify(incompleteRubric)
      });

      expect(response.valid).toBe(false);
      expect(response.errors).toContain('Missing description for criteria: Code Quality');
      expect(response.errors).toContain('Missing weight for criteria: Code Quality');
    });

    test('should enforce rubric weight constraints', async () => {
      const invalidWeights = {
        title: 'Invalid Weights Test',
        courseId,
        rubric: {
          criteria: [
            { name: 'Criteria 1', description: 'Test 1', maxScore: 25, weight: 0.7 },
            { name: 'Criteria 2', description: 'Test 2', maxScore: 25, weight: 0.5 }
            // Total weight = 1.2 (invalid)
          ]
        }
      };

      const response = await apiRequest('/api/assignments/validate', {
        method: 'POST',
        body: JSON.stringify(invalidWeights)
      });

      expect(response.valid).toBe(false);
      expect(response.errors).toContain('Total criteria weights must equal 1.0');
    });
  });

  describe('Rubric Testing with Various Content Types', () => {
    
    test('should test rubric with text-based code submission', async () => {
      const testContent = {
        type: 'text',
        content: `
          /**
           * Calculates the factorial of a number
           * @param {number} n - The number to calculate factorial for
           * @returns {number} The factorial result
           */
          function factorial(n) {
            if (n < 0) {
              throw new Error('Factorial is not defined for negative numbers');
            }
            if (n === 0 || n === 1) {
              return 1;
            }
            return n * factorial(n - 1);
          }
          
          // Test the function
          console.log(factorial(5)); // Should output 120
        `
      };

      const response = await apiRequest('/api/test-rubric', {
        method: 'POST',
        body: JSON.stringify({
          assignmentId,
          testContent
        })
      });

      expect(response.success).toBe(true);
      expect(response.feedback).toHaveProperty('overallScore');
      expect(response.feedback).toHaveProperty('criteriaScores');
      expect(response.feedback.criteriaScores).toHaveLength(4);
      
      // Verify detailed feedback structure
      response.feedback.criteriaScores.forEach(criteria => {
        expect(criteria).toHaveProperty('name');
        expect(criteria).toHaveProperty('score');
        expect(criteria).toHaveProperty('feedback');
        expect(criteria.score).toBeGreaterThanOrEqual(0);
        expect(criteria.score).toBeLessThanOrEqual(25);
      });
    });

    test('should test rubric with image submission', async () => {
      // Simulate a screenshot of code or diagram
      const testContent = {
        type: 'image',
        mimeType: 'image/png',
        content: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
      };

      const response = await apiRequest('/api/test-rubric', {
        method: 'POST',
        body: JSON.stringify({
          assignmentId,
          testContent
        })
      });

      expect(response.success).toBe(true);
      expect(response.feedback.overallFeedback).toContain('image');
      expect(response.feedback.criteriaScores).toHaveLength(4);
    });

    test('should test rubric with document submission', async () => {
      const testContent = {
        type: 'document',
        mimeType: 'application/pdf',
        content: Buffer.from('Mock PDF content for testing').toString('base64')
      };

      const response = await apiRequest('/api/test-rubric', {
        method: 'POST',
        body: JSON.stringify({
          assignmentId,
          testContent
        })
      });

      expect(response.success).toBe(true);
      expect(response.feedback).toHaveProperty('overallScore');
      expect(response.feedback.criteriaScores).toHaveLength(4);
    });

    test('should test rubric with multimodal submission', async () => {
      const testContent = {
        type: 'multimodal',
        parts: [
          {
            type: 'text',
            content: 'Here is my solution with explanation:'
          },
          {
            type: 'text',
            content: 'function solve() { return "solution"; }'
          },
          {
            type: 'image',
            mimeType: 'image/png',
            content: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
          }
        ]
      };

      const response = await apiRequest('/api/test-rubric', {
        method: 'POST',
        body: JSON.stringify({
          assignmentId,
          testContent
        })
      });

      expect(response.success).toBe(true);
      expect(response.feedback.overallFeedback).toBeTruthy();
      expect(response.feedback.criteriaScores).toHaveLength(4);
    });
  });

  describe('Rubric Refinement and Iteration', () => {
    
    test('should allow rubric updates after testing', async () => {
      // Test current rubric
      const testResponse = await apiRequest('/api/test-rubric', {
        method: 'POST',
        body: JSON.stringify({
          assignmentId,
          testContent: {
            type: 'text',
            content: 'function test() { return true; }'
          }
        })
      });

      expect(testResponse.success).toBe(true);

      // Update rubric based on test results
      const updatedRubric = {
        criteria: [
          {
            name: 'Code Quality',
            description: 'Updated: Code structure, readability, and best practices',
            maxScore: 30,
            weight: 0.35
          },
          {
            name: 'Functionality',
            description: 'Whether the code produces correct results',
            maxScore: 25,
            weight: 0.35
          },
          {
            name: 'Documentation',
            description: 'Quality of comments and explanations',
            maxScore: 25,
            weight: 0.2
          },
          {
            name: 'Innovation',
            description: 'Creative approaches and problem-solving techniques',
            maxScore: 20,
            weight: 0.1
          }
        ]
      };

      const updateResponse = await apiRequest(`/api/assignments/${assignmentId}`, {
        method: 'PUT',
        body: JSON.stringify({ rubric: updatedRubric })
      });

      expect(updateResponse.success).toBe(true);
      expect(updateResponse.assignment.rubric.criteria[0].maxScore).toBe(30);
    });

    test('should maintain rubric version history', async () => {
      const historyResponse = await apiRequest(`/api/assignments/${assignmentId}/rubric-history`);
      
      expect(historyResponse.versions).toBeInstanceOf(Array);
      expect(historyResponse.versions.length).toBeGreaterThan(0);
      
      historyResponse.versions.forEach(version => {
        expect(version).toHaveProperty('version');
        expect(version).toHaveProperty('criteria');
        expect(version).toHaveProperty('updatedAt');
      });
    });

    test('should compare rubric performance across versions', async () => {
      const comparisonResponse = await apiRequest(`/api/assignments/${assignmentId}/rubric-comparison`, {
        method: 'POST',
        body: JSON.stringify({
          testContent: {
            type: 'text',
            content: 'function complexFunction() { /* complex logic */ return result; }'
          }
        })
      });

      expect(comparisonResponse.success).toBe(true);
      expect(comparisonResponse.comparison).toHaveProperty('currentVersion');
      expect(comparisonResponse.comparison).toHaveProperty('previousVersion');
      expect(comparisonResponse.comparison).toHaveProperty('differences');
    });
  });

  describe('Assignment Management and Monitoring', () => {
    
    test('should retrieve assignment analytics', async () => {
      const analyticsResponse = await apiRequest(`/api/assignments/${assignmentId}/analytics`);
      
      expect(analyticsResponse.analytics).toHaveProperty('totalSubmissions');
      expect(analyticsResponse.analytics).toHaveProperty('averageScore');
      expect(analyticsResponse.analytics).toHaveProperty('scoreDistribution');
      expect(analyticsResponse.analytics).toHaveProperty('criteriaPerformance');
      expect(analyticsResponse.analytics).toHaveProperty('processingStats');
    });

    test('should monitor AI feedback quality', async () => {
      const qualityResponse = await apiRequest(`/api/assignments/${assignmentId}/feedback-quality`);
      
      expect(qualityResponse.quality).toHaveProperty('consistency');
      expect(qualityResponse.quality).toHaveProperty('fairness');
      expect(qualityResponse.quality).toHaveProperty('responseTime');
      expect(qualityResponse.quality).toHaveProperty('errorRate');
      
      // Quality metrics should be within acceptable ranges
      expect(qualityResponse.quality.consistency).toBeGreaterThan(0.8);
      expect(qualityResponse.quality.errorRate).toBeLessThan(0.05);
    });

    test('should provide real-time submission monitoring', async () => {
      const monitoringResponse = await apiRequest(`/api/assignments/${assignmentId}/monitoring`);
      
      expect(monitoringResponse.status).toHaveProperty('totalSubmissions');
      expect(monitoringResponse.status).toHaveProperty('processingQueue');
      expect(monitoringResponse.status).toHaveProperty('completedToday');
      expect(monitoringResponse.status).toHaveProperty('averageProcessingTime');
      expect(monitoringResponse.status).toHaveProperty('systemHealth');
    });
  });

  describe('Bulk Operations and Efficiency', () => {
    
    test('should handle bulk rubric testing', async () => {
      const testSamples = [
        {
          id: 'sample-1',
          type: 'text',
          content: 'function good() { return "excellent code"; }'
        },
        {
          id: 'sample-2',
          type: 'text',
          content: 'console.log("basic");'
        },
        {
          id: 'sample-3',
          type: 'text',
          content: 'function advanced() { /* complex algorithm */ return optimizedResult; }'
        }
      ];

      const bulkResponse = await apiRequest('/api/test-rubric/bulk', {
        method: 'POST',
        body: JSON.stringify({
          assignmentId,
          testSamples
        })
      });

      expect(bulkResponse.success).toBe(true);
      expect(bulkResponse.results).toHaveLength(3);
      
      bulkResponse.results.forEach((result, index) => {
        expect(result.sampleId).toBe(testSamples[index].id);
        expect(result.feedback).toHaveProperty('overallScore');
        expect(result.feedback.criteriaScores).toHaveLength(4);
      });
    });

    test('should provide rubric calibration suggestions', async () => {
      const calibrationResponse = await apiRequest(`/api/assignments/${assignmentId}/calibration`);
      
      expect(calibrationResponse.suggestions).toBeInstanceOf(Array);
      
      if (calibrationResponse.suggestions.length > 0) {
        calibrationResponse.suggestions.forEach(suggestion => {
          expect(suggestion).toHaveProperty('type');
          expect(suggestion).toHaveProperty('description');
          expect(suggestion).toHaveProperty('impact');
          expect(suggestion).toHaveProperty('recommendation');
        });
      }
    });

    test('should export assignment and rubric data', async () => {
      const exportResponse = await apiRequest(`/api/assignments/${assignmentId}/export`, {
        method: 'POST',
        body: JSON.stringify({
          format: 'json',
          includeSubmissions: true,
          includeFeedback: true
        })
      });

      expect(exportResponse.success).toBe(true);
      expect(exportResponse.exportData).toHaveProperty('assignment');
      expect(exportResponse.exportData).toHaveProperty('rubric');
      expect(exportResponse.exportData).toHaveProperty('submissions');
      expect(exportResponse.exportData).toHaveProperty('analytics');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    
    test('should handle invalid rubric test content', async () => {
      const invalidContent = {
        type: 'unsupported',
        content: null
      };

      const response = await apiRequest('/api/test-rubric', {
        method: 'POST',
        body: JSON.stringify({
          assignmentId,
          testContent: invalidContent
        })
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Invalid content type');
    });

    test('should handle AI service unavailability', async () => {
      // Simulate AI service down by using invalid assignment
      const response = await apiRequest('/api/test-rubric', {
        method: 'POST',
        body: JSON.stringify({
          assignmentId: 'nonexistent-assignment',
          testContent: {
            type: 'text',
            content: 'test content'
          }
        })
      });

      expect(response.success).toBe(false);
      expect(response.error).toBeTruthy();
    });

    test('should validate permissions for assignment operations', async () => {
      // Test with different user role
      const unauthorizedResponse = await apiRequest(`/api/assignments/${assignmentId}`, {
        method: 'PUT',
        headers: {
          'X-User-Role': 'student'
        },
        body: JSON.stringify({
          rubric: { criteria: [] }
        })
      });

      expect(unauthorizedResponse.success).toBe(false);
      expect(unauthorizedResponse.error).toContain('permission');
    });
  });

  describe('Integration with Student Submissions', () => {
    
    test('should simulate full instructor-student workflow', async () => {
      // 1. Instructor creates assignment (already done)
      expect(assignmentId).toBeTruthy();

      // 2. Test rubric with sample content
      const rubricTest = await apiRequest('/api/test-rubric', {
        method: 'POST',
        body: JSON.stringify({
          assignmentId,
          testContent: {
            type: 'text',
            content: 'function fibonacci(n) { return n <= 1 ? n : fibonacci(n-1) + fibonacci(n-2); }'
          }
        })
      });

      expect(rubricTest.success).toBe(true);

      // 3. Simulate student submission
      const studentSubmission = await apiRequest('/api/submissions', {
        method: 'POST',
        body: JSON.stringify({
          assignmentId,
          studentId: 'test-student-workflow',
          content: 'function fibonacci(n) { return n <= 1 ? n : fibonacci(n-1) + fibonacci(n-2); }',
          submissionType: 'text'
        })
      });

      expect(studentSubmission.success).toBe(true);

      // 4. Wait for AI processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 5. Check feedback generation
      const feedback = await apiRequest(`/api/submissions/${studentSubmission.submission.id}/feedback`);
      
      expect(feedback.feedback).toBeTruthy();
      expect(feedback.feedback.overallScore).toBeGreaterThanOrEqual(0);
      expect(feedback.feedback.criteriaScores).toHaveLength(4);

      // 6. Instructor reviews results
      const submissionReview = await apiRequest(`/api/assignments/${assignmentId}/submissions`);
      
      expect(submissionReview.submissions).toBeInstanceOf(Array);
      expect(submissionReview.submissions.length).toBeGreaterThan(0);
    });
  });
});