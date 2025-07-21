import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BatchOperationsService } from '../../server/services/batch-operations';
import { db } from '../../server/db';
import { courses, assignments, users, enrollments, submissions, feedback } from '../../shared/schema';

// Mock the database queries
vi.mock('../../server/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    execute: vi.fn(),
  }
}));

// Mock the storage
vi.mock('../../server/storage', () => ({
  storage: {
    getCourse: vi.fn(),
  }
}));

describe('BatchOperationsService', () => {
  let batchService: BatchOperationsService;
  
  beforeEach(() => {
    batchService = new BatchOperationsService();
    vi.clearAllMocks();
  });
  
  describe('batchEnrollStudents', () => {
    it('should throw error if course not found', async () => {
      // Setup mock to return null for getCourse
      const { storage } = await import('../../server/storage');
      vi.mocked(storage.getCourse).mockResolvedValue(undefined);
      
      // Test the method
      await expect(batchService.batchEnrollStudents(999, [1, 2, 3]))
        .rejects
        .toThrow('Course 999 not found');
    });
    
    it('should enroll students successfully', async () => {
      // Setup mocks
      const { storage } = await import('../../server/storage');
      vi.mocked(storage.getCourse).mockResolvedValue({
        id: 1,
        name: 'Test Course',
        code: 'TEST101',
        description: 'Test course description',
        createdAt: new Date(),
      });
      
      vi.mocked(db.select).mockReturnThis();
      vi.mocked(db.from).mockReturnThis();
      vi.mocked(db.where).mockResolvedValue([{ userId: 1 }]); // Mock existing enrollment
      
      vi.mocked(db.insert).mockReturnThis();
      vi.mocked(db.values).mockReturnThis();
      vi.mocked(db.returning).mockResolvedValue([{ id: 1 }, { id: 2 }]);
      
      // Test the method
      const result = await batchService.batchEnrollStudents(1, [1, 2, 3]);
      
      // Assertions
      expect(result.success).toBe(3); // 1 already enrolled + 2 newly enrolled
      expect(result.failed).toBe(0);
    });
  });
  
  describe('getUserProgressForCourse', () => {
    it('should throw error if course not found', async () => {
      // Setup mock to return null for getCourse
      const { storage } = await import('../../server/storage');
      vi.mocked(storage.getCourse).mockResolvedValue(undefined);
      
      // Test the method
      await expect(batchService.getUserProgressForCourse(999))
        .rejects
        .toThrow('Course 999 not found');
    });
    
    it('should return progress data correctly', async () => {
      // Setup mocks
      const { storage } = await import('../../server/storage');
      const courseMock = {
        id: 1,
        name: 'Test Course',
        code: 'TEST101',
        description: 'Test course description',
        createdAt: new Date(),
      };
      vi.mocked(storage.getCourse).mockResolvedValue(courseMock);
      
      const assignmentsMock = [
        { id: 1, title: 'Assignment 1', dueDate: new Date(), courseId: 1 },
        { id: 2, title: 'Assignment 2', dueDate: new Date(), courseId: 1 },
      ];
      vi.mocked(db.select).mockImplementation(() => {
        const mock = vi.mocked(db);
        mock.from.mockImplementation((table) => {
          if (table === assignments) {
            mock.where.mockImplementation(() => {
              mock.orderBy.mockResolvedValue(assignmentsMock);
              return mock;
            });
            return mock;
          }
          if (table === users) {
            mock.innerJoin.mockImplementation(() => {
              mock.where.mockImplementation(() => {
                mock.orderBy.mockResolvedValue([
                  { userId: 1, name: 'Test User', email: 'test@example.com' }
                ]);
                return mock;
              });
              return mock;
            });
            return mock;
          }
          if (table === submissions) {
            mock.where.mockResolvedValue([
              { 
                id: 1, 
                userId: 1, 
                assignmentId: 1, 
                status: 'completed', 
                createdAt: new Date() 
              }
            ]);
            return mock;
          }
          if (table === feedback) {
            mock.where.mockResolvedValue([
              { 
                id: 1, 
                submissionId: 1, 
                score: 85 
              }
            ]);
            return mock;
          }
          return mock;
        });
        return mock as any;
      });
      
      // Mock the chunkArray method
      const originalChunkArray = batchService['chunkArray'];
      batchService['chunkArray'] = vi.fn().mockImplementation((arr) => [arr]);
      
      // Test the method
      const result = await batchService.getUserProgressForCourse(1);
      
      // Restore the original method
      batchService['chunkArray'] = originalChunkArray;
      
      // Assertions
      expect(result.courseId).toBe(1);
      expect(result.courseName).toBe('Test Course');
      expect(result.totalAssignments).toBe(2);
      expect(result.totalStudents).toBe(1);
      expect(result.students.length).toBe(1);
      expect(result.students[0].completionRate).toBe(0.5);
      expect(result.students[0].averageScore).toBe(85);
    });
  });
});