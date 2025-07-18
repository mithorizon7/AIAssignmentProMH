/**
 * Performance and Reliability Tests
 * 
 * Tests for AI feedback system performance, reliability, and scalability
 * under various load conditions and edge cases.
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { apiRequest } from '@/lib/queryClient';

describe('Performance and Reliability Tests', () => {
  
  const testEnvironment = {
    instructorId: 'perf-test-instructor',
    courseId: 'perf-test-course',
    assignmentId: '',
    students: Array.from({ length: 10 }, (_, i) => `perf-student-${i + 1}`)
  };

  beforeAll(async () => {
    // Setup performance test environment
    await apiRequest('/api/test-setup/performance', {
      method: 'POST',
      body: JSON.stringify({
        instructorId: testEnvironment.instructorId,
        courseId: testEnvironment.courseId,
        studentIds: testEnvironment.students,
        courseName: 'Performance Test Course'
      })
    });

    // Create test assignment
    const assignmentResponse = await apiRequest('/api/assignments', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Performance Test Assignment',
        courseId: testEnvironment.courseId,
        rubric: {
          criteria: [
            { name: 'Performance', description: 'Code efficiency', maxScore: 50, weight: 0.5 },
            { name: 'Readability', description: 'Code clarity', maxScore: 50, weight: 0.5 }
          ]
        }
      })
    });

    testEnvironment.assignmentId = assignmentResponse.assignment.id;
  });

  afterAll(async () => {
    // Cleanup performance test data
    await apiRequest('/api/test-cleanup/performance', {
      method: 'POST',
      body: JSON.stringify(testEnvironment)
    });
  });

  describe('Load Testing', () => {
    
    test('should handle concurrent submission processing', async () => {
      const submissions = testEnvironment.students.map((studentId, index) => 
        apiRequest('/api/submissions', {
          method: 'POST',
          body: JSON.stringify({
            assignmentId: testEnvironment.assignmentId,
            studentId,
            content: `
              // Student ${index + 1} submission
              function solution${index + 1}() {
                const data = Array.from({length: 1000}, (_, i) => i);
                return data.filter(x => x % 2 === 0).map(x => x * 2);
              }
              
              console.log(solution${index + 1}());
            `,
            submissionType: 'text'
          })
        })
      );

      const startTime = Date.now();
      const results = await Promise.all(submissions);
      const duration = Date.now() - startTime;

      // All submissions should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.submission).toHaveProperty('id');
      });

      // Should handle 10 concurrent submissions within reasonable time
      expect(duration).toBeLessThan(10000); // 10 seconds max
      console.log(`Concurrent submissions processed in ${duration}ms`);
    });

    test('should maintain system responsiveness under load', async () => {
      // Simulate high load with rapid submissions
      const rapidSubmissions = [];
      
      for (let i = 0; i < 20; i++) {
        rapidSubmissions.push(
          apiRequest('/api/submissions', {
            method: 'POST',
            body: JSON.stringify({
              assignmentId: testEnvironment.assignmentId,
              studentId: testEnvironment.students[i % testEnvironment.students.length],
              content: `function rapid${i}() { return ${i}; }`,
              submissionType: 'text'
            })
          })
        );
        
        // Small delay between submissions
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const results = await Promise.allSettled(rapidSubmissions);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      // Most should succeed, some might fail due to rate limiting
      expect(successful).toBeGreaterThan(15);
      expect(failed).toBeLessThan(5);

      console.log(`Rapid submissions: ${successful} successful, ${failed} failed`);
    });

    test('should handle queue backlog efficiently', async () => {
      // Check initial queue status
      const initialStatus = await apiRequest('/api/queue/status');
      
      // Add many submissions to create backlog
      const backlogPromises = Array.from({ length: 15 }, (_, i) =>
        apiRequest('/api/submissions', {
          method: 'POST',
          body: JSON.stringify({
            assignmentId: testEnvironment.assignmentId,
            studentId: testEnvironment.students[i % testEnvironment.students.length],
            content: `function backlog${i}() { /* Complex processing */ return processData(); }`,
            submissionType: 'text'
          })
        })
      );

      await Promise.all(backlogPromises);

      // Monitor queue processing
      let processed = 0;
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds max

      while (processed < 15 && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const queueStatus = await apiRequest('/api/queue/status');
        processed = queueStatus.completed - initialStatus.completed;
        attempts++;
      }

      expect(processed).toBeGreaterThan(10); // Most should be processed
      console.log(`Queue processed ${processed} submissions in ${attempts} seconds`);
    });
  });

  describe('Response Time Performance', () => {
    
    test('should meet response time SLAs for text submissions', async () => {
      const testCases = [
        { name: 'Simple function', content: 'function simple() { return true; }' },
        { name: 'Medium complexity', content: 'function bubbleSort(arr) { /* sorting implementation */ }' },
        { name: 'Complex algorithm', content: 'function dijkstra(graph, start) { /* pathfinding implementation */ }' }
      ];

      for (const testCase of testCases) {
        const startTime = Date.now();
        
        const response = await apiRequest('/api/ai/analyze', {
          method: 'POST',
          body: JSON.stringify({
            content: { type: 'text', content: testCase.content },
            rubric: {
              criteria: [
                { name: 'Quality', description: 'Code quality', maxScore: 100, weight: 1.0 }
              ]
            }
          })
        });

        const responseTime = Date.now() - startTime;

        expect(response.success).toBe(true);
        expect(responseTime).toBeLessThan(15000); // 15 seconds SLA
        
        console.log(`${testCase.name}: ${responseTime}ms`);
      }
    });

    test('should handle image submissions within acceptable time', async () => {
      const imageContent = {
        type: 'image',
        mimeType: 'image/png',
        content: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
      };

      const startTime = Date.now();
      
      const response = await apiRequest('/api/ai/analyze', {
        method: 'POST',
        body: JSON.stringify({
          content: imageContent,
          rubric: {
            criteria: [
              { name: 'Visual Quality', description: 'Image analysis', maxScore: 100, weight: 1.0 }
            ]
          }
        })
      });

      const responseTime = Date.now() - startTime;

      expect(response.success).toBe(true);
      expect(responseTime).toBeLessThan(25000); // 25 seconds for image processing
      
      console.log(`Image processing: ${responseTime}ms`);
    });

    test('should provide progress updates for long-running tasks', async () => {
      const largeSubmission = {
        assignmentId: testEnvironment.assignmentId,
        studentId: testEnvironment.students[0],
        content: 'function complex() {\n' + '  // Complex logic\n'.repeat(500) + '}',
        submissionType: 'text'
      };

      const submissionResponse = await apiRequest('/api/submissions', {
        method: 'POST',
        body: JSON.stringify(largeSubmission)
      });

      const submissionId = submissionResponse.submission.id;
      const statusUpdates = [];

      // Poll for status updates
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await apiRequest(`/api/submissions/${submissionId}/status`);
        statusUpdates.push({
          timestamp: Date.now(),
          status: statusResponse.status,
          progress: statusResponse.progress
        });

        if (statusResponse.status === 'completed') break;
      }

      expect(statusUpdates.length).toBeGreaterThan(0);
      expect(statusUpdates.some(update => update.status === 'processing')).toBe(true);
    });
  });

  describe('Memory and Resource Management', () => {
    
    test('should maintain stable memory usage under sustained load', async () => {
      const initialMemory = process.memoryUsage();
      
      // Process multiple batches of submissions
      for (let batch = 0; batch < 5; batch++) {
        const batchPromises = Array.from({ length: 5 }, (_, i) =>
          apiRequest('/api/submissions', {
            method: 'POST',
            body: JSON.stringify({
              assignmentId: testEnvironment.assignmentId,
              studentId: testEnvironment.students[i],
              content: `function batch${batch}_${i}() { return "memory test"; }`,
              submissionType: 'text'
            })
          })
        );

        await Promise.all(batchPromises);
        
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 200MB for this test)
      expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024);
      
      console.log(`Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
    });

    test('should handle large file submissions efficiently', async () => {
      const largeContent = Array.from({ length: 1000 }, (_, i) => 
        `function func${i}() { console.log("Large file test ${i}"); }`
      ).join('\n');

      const startTime = Date.now();
      const initialMemory = process.memoryUsage().heapUsed;

      const response = await apiRequest('/api/submissions', {
        method: 'POST',
        body: JSON.stringify({
          assignmentId: testEnvironment.assignmentId,
          studentId: testEnvironment.students[0],
          content: largeContent,
          submissionType: 'text'
        })
      });

      const endTime = Date.now();
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryDelta = finalMemory - initialMemory;

      expect(response.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(30000); // 30 seconds max
      expect(memoryDelta).toBeLessThan(100 * 1024 * 1024); // 100MB max increase
      
      console.log(`Large file processing: ${endTime - startTime}ms, Memory: ${Math.round(memoryDelta / 1024 / 1024)}MB`);
    });

    test('should clean up temporary resources properly', async () => {
      // Submit file-based submissions that require temporary storage
      const fileSubmissions = Array.from({ length: 5 }, (_, i) => {
        const formData = new FormData();
        const content = `console.log("Temp file ${i}");`;
        formData.append('file', new Blob([content], { type: 'text/javascript' }), `temp${i}.js`);
        formData.append('assignmentId', testEnvironment.assignmentId);
        formData.append('studentId', testEnvironment.students[i]);

        return fetch('/api/submissions/upload', {
          method: 'POST',
          body: formData
        }).then(r => r.json());
      });

      const results = await Promise.all(fileSubmissions);
      
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check that temporary files are cleaned up
      const cleanupResponse = await apiRequest('/api/system/temp-files');
      expect(cleanupResponse.tempFileCount).toBeLessThan(10);
    });
  });

  describe('Error Recovery and Resilience', () => {
    
    test('should recover from temporary AI service failures', async () => {
      // Simulate service failure scenario
      const submissions = Array.from({ length: 3 }, (_, i) =>
        apiRequest('/api/submissions', {
          method: 'POST',
          body: JSON.stringify({
            assignmentId: testEnvironment.assignmentId,
            studentId: testEnvironment.students[i],
            content: `function recovery${i}() { return "resilience test"; }`,
            submissionType: 'text'
          })
        })
      );

      const results = await Promise.all(submissions);
      
      // Wait for processing with potential retries
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Check that submissions eventually complete
      for (const result of results) {
        const finalStatus = await apiRequest(`/api/submissions/${result.submission.id}/status`);
        expect(['completed', 'failed']).toContain(finalStatus.status);
        
        if (finalStatus.status === 'failed') {
          expect(finalStatus.retryCount).toBeGreaterThan(0);
        }
      }
    });

    test('should handle database connection issues gracefully', async () => {
      // Test submission during potential database stress
      const dbStressSubmissions = Array.from({ length: 10 }, (_, i) =>
        apiRequest('/api/submissions', {
          method: 'POST',
          body: JSON.stringify({
            assignmentId: testEnvironment.assignmentId,
            studentId: testEnvironment.students[i % testEnvironment.students.length],
            content: `function dbStress${i}() { return "database test"; }`,
            submissionType: 'text'
          })
        })
      );

      const results = await Promise.allSettled(dbStressSubmissions);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      
      // Most should succeed even under database stress
      expect(successful).toBeGreaterThan(7);
    });

    test('should maintain system availability during high error rates', async () => {
      // Submit various problematic content that might cause AI failures
      const problematicSubmissions = [
        { content: '', type: 'text' }, // Empty content
        { content: '!@#$%^&*()_+', type: 'text' }, // Invalid characters
        { content: 'a'.repeat(100000), type: 'text' }, // Extremely long content
        { content: 'function() { while(true) {} }', type: 'text' }, // Potentially problematic code
        { content: '<?php echo "wrong language"; ?>', type: 'text' } // Wrong language
      ];

      const submissions = problematicSubmissions.map((prob, i) =>
        apiRequest('/api/submissions', {
          method: 'POST',
          body: JSON.stringify({
            assignmentId: testEnvironment.assignmentId,
            studentId: testEnvironment.students[i],
            content: prob.content,
            submissionType: prob.type
          })
        })
      );

      const results = await Promise.allSettled(submissions);
      
      // System should handle errors gracefully without crashing
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          expect(result.value).toHaveProperty('success');
        } else {
          expect(result.reason).toBeInstanceOf(Error);
        }
      });

      // System should remain responsive
      const healthCheck = await apiRequest('/api/health');
      expect(healthCheck.status).toBe('healthy');
    });
  });

  describe('Scalability Testing', () => {
    
    test('should scale queue workers based on load', async () => {
      const initialWorkers = await apiRequest('/api/queue/workers');
      
      // Create high load
      const highLoadSubmissions = Array.from({ length: 25 }, (_, i) =>
        apiRequest('/api/submissions', {
          method: 'POST',
          body: JSON.stringify({
            assignmentId: testEnvironment.assignmentId,
            studentId: testEnvironment.students[i % testEnvironment.students.length],
            content: `function scale${i}() { return "scaling test"; }`,
            submissionType: 'text'
          })
        })
      );

      await Promise.all(highLoadSubmissions);

      // Wait for auto-scaling
      await new Promise(resolve => setTimeout(resolve, 5000));

      const scaledWorkers = await apiRequest('/api/queue/workers');
      
      // Should scale up workers under load
      expect(scaledWorkers.activeWorkers).toBeGreaterThanOrEqual(initialWorkers.activeWorkers);
    });

    test('should maintain consistent performance across different assignment types', async () => {
      const assignmentTypes = [
        { name: 'Simple Programming', criteria: 2 },
        { name: 'Complex Algorithm', criteria: 5 },
        { name: 'Code Review', criteria: 8 }
      ];

      const performanceResults = [];

      for (const assignmentType of assignmentTypes) {
        const assignmentResponse = await apiRequest('/api/assignments', {
          method: 'POST',
          body: JSON.stringify({
            title: assignmentType.name,
            courseId: testEnvironment.courseId,
            rubric: {
              criteria: Array.from({ length: assignmentType.criteria }, (_, i) => ({
                name: `Criteria ${i + 1}`,
                description: `Test criteria ${i + 1}`,
                maxScore: Math.floor(100 / assignmentType.criteria),
                weight: 1 / assignmentType.criteria
              }))
            }
          })
        });

        const startTime = Date.now();
        
        const submissionResponse = await apiRequest('/api/submissions', {
          method: 'POST',
          body: JSON.stringify({
            assignmentId: assignmentResponse.assignment.id,
            studentId: testEnvironment.students[0],
            content: 'function test() { return "performance test"; }',
            submissionType: 'text'
          })
        });

        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const endTime = Date.now();
        performanceResults.push({
          type: assignmentType.name,
          criteria: assignmentType.criteria,
          processingTime: endTime - startTime
        });
      }

      // Performance should not degrade significantly with more criteria
      const maxTime = Math.max(...performanceResults.map(r => r.processingTime));
      const minTime = Math.min(...performanceResults.map(r => r.processingTime));
      
      expect(maxTime / minTime).toBeLessThan(3); // No more than 3x difference
      
      console.log('Performance across assignment types:', performanceResults);
    });
  });

  describe('Data Consistency and Integrity', () => {
    
    test('should maintain data consistency under concurrent operations', async () => {
      const studentId = testEnvironment.students[0];
      
      // Concurrent operations on same student
      const concurrentOps = [
        apiRequest('/api/submissions', {
          method: 'POST',
          body: JSON.stringify({
            assignmentId: testEnvironment.assignmentId,
            studentId,
            content: 'function concurrent1() { return "test1"; }',
            submissionType: 'text'
          })
        }),
        apiRequest(`/api/students/${studentId}/submissions`),
        apiRequest(`/api/students/${studentId}/analytics`),
        apiRequest('/api/submissions', {
          method: 'POST',
          body: JSON.stringify({
            assignmentId: testEnvironment.assignmentId,
            studentId,
            content: 'function concurrent2() { return "test2"; }',
            submissionType: 'text'
          })
        })
      ];

      const results = await Promise.all(concurrentOps);
      
      // All operations should succeed without data corruption
      results.forEach(result => {
        expect(result).toBeTruthy();
      });

      // Verify data consistency
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const finalCheck = await apiRequest(`/api/students/${studentId}/submissions`);
      expect(finalCheck.submissions).toBeInstanceOf(Array);
      expect(finalCheck.submissions.length).toBeGreaterThan(0);
    });

    test('should handle transaction rollbacks properly', async () => {
      // Test scenario that might cause transaction failure
      const invalidSubmission = {
        assignmentId: 'nonexistent-assignment',
        studentId: testEnvironment.students[0],
        content: 'function invalid() { return "should fail"; }',
        submissionType: 'text'
      };

      const response = await apiRequest('/api/submissions', {
        method: 'POST',
        body: JSON.stringify(invalidSubmission)
      });

      expect(response.success).toBe(false);
      
      // Verify system state is not corrupted
      const systemStatus = await apiRequest('/api/health');
      expect(systemStatus.status).toBe('healthy');
    });
  });
});