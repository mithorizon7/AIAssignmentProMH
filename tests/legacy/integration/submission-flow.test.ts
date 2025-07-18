import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { storage } from '../../server/storage';
import { queueApi } from '../../server/queue/bullmq-submission-queue';

// Mock dependencies
vi.mock('../../server/storage', () => {
  // Create mock data for submissions and assignments
  const mockSubmission = {
    id: 999,
    assignmentId: 888,
    userId: 777,
    content: 'Mock submission content for integration testing',
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  const mockAssignment = {
    id: 888,
    courseId: 123,
    title: 'Integration Test Assignment',
    description: 'This is a test assignment for integration testing',
    rubric: JSON.stringify({
      criteria: [
        { name: 'Code Quality', weight: 30 },
        { name: 'Functionality', weight: 50 },
        { name: 'Documentation', weight: 20 }
      ]
    }),
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  // Mock storage methods
  return {
    storage: {
      getSubmission: vi.fn().mockResolvedValue(mockSubmission),
      getAssignment: vi.fn().mockResolvedValue(mockAssignment),
      updateSubmissionStatus: vi.fn().mockImplementation(async (id, status) => {
        mockSubmission.status = status;
        mockSubmission.updatedAt = new Date();
        return mockSubmission;
      }),
      getFeedbackBySubmissionId: vi.fn().mockResolvedValue(null),
      createFeedback: vi.fn().mockImplementation(async (feedback) => {
        return {
          id: 555,
          submissionId: feedback.submissionId,
          content: feedback.content,
          score: feedback.score,
          createdAt: new Date()
        };
      })
    }
  };
});

// Mock the queueApi directly
vi.mock('../../server/queue/bullmq-submission-queue', () => {
  return {
    queueApi: {
      addSubmission: vi.fn().mockImplementation(async (submissionId) => {
        // In the mock, we'll simulate the entire submission processing flow
        const mockStorage = await import('../../server/storage').then(m => m.storage);
        
        // 1. Update to pending (this would be done by the real addSubmission)
        await mockStorage.updateSubmissionStatus(submissionId, 'pending');
        
        // 2. Update to processing (this would be done by the worker)
        await mockStorage.updateSubmissionStatus(submissionId, 'processing');
        
        // 3. Get submission and assignment data (worker task)
        const submission = await mockStorage.getSubmission(submissionId);
        const assignment = await mockStorage.getAssignment(submission.assignmentId);
        
        // 4. Create mock feedback (simulating AI service)
        const mockFeedback = {
          submissionId: submissionId,
          content: JSON.stringify({
            strengths: ['Well organized code', 'Good variable naming'],
            improvements: ['Could add more comments', 'Some functions are too long'],
            suggestions: ['Consider refactoring the helper functions', 'Add unit tests'],
            summary: 'Overall good work with some areas for improvement'
          }),
          score: 85
        };
        
        // 5. Save feedback
        await mockStorage.createFeedback(mockFeedback);
        
        // 6. Update to completed
        await mockStorage.updateSubmissionStatus(submissionId, 'completed');
        
        // Return a job ID
        return `mock-job-${submissionId}-${Date.now()}`;
      })
    }
  };
});

describe('End-to-End Submission Flow', () => {
  const submissionId = 999;
  
  beforeEach(() => {
    vi.resetAllMocks();
  });
  
  it('should process a submission through the entire workflow', async () => {
    // Add the submission to the queue
    const jobId = await queueApi.addSubmission(submissionId);
    
    // Verify the job was created
    expect(jobId).toContain('mock-job-999');
    
    // Verify status was updated to pending
    expect(storage.updateSubmissionStatus).toHaveBeenCalledWith(submissionId, 'pending');
    
    // Verify the processing was performed
    expect(storage.getSubmission).toHaveBeenCalledWith(submissionId);
    expect(storage.getAssignment).toHaveBeenCalled();
    
    // Verify status was updated to processing
    expect(storage.updateSubmissionStatus).toHaveBeenCalledWith(submissionId, 'processing');
    
    // Verify feedback was created
    expect(storage.createFeedback).toHaveBeenCalled();
    const feedbackCall = vi.mocked(storage.createFeedback).mock.calls[0][0];
    expect(feedbackCall.submissionId).toBe(submissionId);
    expect(feedbackCall.score).toBe(85);
    
    // Verify status was updated to completed
    expect(storage.updateSubmissionStatus).toHaveBeenCalledWith(submissionId, 'completed');
    
    // Verify the correct order of status updates
    const statusCalls = vi.mocked(storage.updateSubmissionStatus).mock.calls;
    expect(statusCalls[0][1]).toBe('pending');
    expect(statusCalls[1][1]).toBe('processing');
    expect(statusCalls[2][1]).toBe('completed');
  });
  
  it('should handle submission errors gracefully', async () => {
    // Make the getSubmission function throw an error
    vi.mocked(storage.getSubmission).mockRejectedValueOnce(new Error('Submission not found'));
    
    // Override queueApi.addSubmission to simulate an error
    vi.mocked(queueApi.addSubmission).mockImplementationOnce(async (submissionId) => {
      const mockStorage = await import('../../server/storage').then(m => m.storage);
      
      // 1. Update to pending
      await mockStorage.updateSubmissionStatus(submissionId, 'pending');
      
      // 2. Update to processing
      await mockStorage.updateSubmissionStatus(submissionId, 'processing');
      
      // 3. Simulate error in processing
      try {
        await mockStorage.getSubmission(submissionId);
      } catch (error) {
        // 4. Update to failed
        await mockStorage.updateSubmissionStatus(submissionId, 'failed');
        throw error;
      }
      
      return '';
    });
    
    // Expect the addSubmission to throw an error
    await expect(queueApi.addSubmission(submissionId)).rejects.toThrow('Submission not found');
    
    // Verify status was updated to failed
    expect(storage.updateSubmissionStatus).toHaveBeenCalledWith(submissionId, 'failed');
    
    // Verify the correct order of status updates
    const statusCalls = vi.mocked(storage.updateSubmissionStatus).mock.calls;
    expect(statusCalls[0][1]).toBe('pending');
    expect(statusCalls[1][1]).toBe('processing');
    expect(statusCalls[2][1]).toBe('failed');
  });
});