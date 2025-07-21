import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { eq, desc, and, SQL } from 'drizzle-orm';

// Mock the database client
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  execute: vi.fn(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockReturnValue([{ id: 1, assignmentId: 1, userId: 1, content: 'test content' }]),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
};

// Mock the schema types
interface Submission {
  id: number;
  assignmentId: number;
  userId: number;
  fileUrl?: string;
  fileName?: string;
  content?: string;
  notes?: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

interface InsertSubmission {
  assignmentId: number;
  userId: number;
  fileUrl?: string;
  fileName?: string;
  content?: string;
  notes?: string;
  status?: string;
}

describe('Submission Error Handling', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    
    // Default successful response for db.execute
    mockDb.execute.mockResolvedValue({ rows: [{ id: 1, assignmentId: 1, userId: 1, status: 'pending' }] });
  });
  
  it('should handle database column errors in createSubmission', async () => {
    // Mock db.insert().values().returning() to throw an error about missing column
    mockDb.returning.mockImplementationOnce(() => {
      throw new Error('column "mime_type" of relation "submissions" does not exist');
    });
    
    // Create the submission function with error handling
    const createSubmission = async (insertSubmission: InsertSubmission): Promise<Submission> => {
      try {
        // Create a new object with only the known fields to avoid column errors
        const safeSubmission = {
          assignmentId: insertSubmission.assignmentId,
          userId: insertSubmission.userId,
          fileUrl: insertSubmission.fileUrl,
          fileName: insertSubmission.fileName,
          content: insertSubmission.content,
          notes: insertSubmission.notes,
          status: insertSubmission.status || 'pending',
        };
        
        const [submission] = await mockDb.insert().values(safeSubmission).returning();
        return submission;
      } catch (error) {
        console.error("Error creating submission:", error);
        
        // Fallback approach with raw SQL if there's a schema issue
        const sql = `
          INSERT INTO submissions (assignment_id, user_id, file_url, file_name, content, notes, status)
          VALUES (
            ${insertSubmission.assignmentId}, 
            ${insertSubmission.userId}, 
            ${insertSubmission.fileUrl ? `'${insertSubmission.fileUrl}'` : 'NULL'},
            ${insertSubmission.fileName ? `'${insertSubmission.fileName}'` : 'NULL'},
            ${insertSubmission.content ? `'${insertSubmission.content}'` : 'NULL'},
            ${insertSubmission.notes ? `'${insertSubmission.notes}'` : 'NULL'},
            '${insertSubmission.status || 'pending'}'
          )
          RETURNING *;
        `;
        
        const result = await mockDb.execute(sql);
        return result.rows[0] as Submission;
      }
    };
    
    // Test with a minimal submission
    const testSubmission: InsertSubmission = {
      assignmentId: 1,
      userId: 1
    };
    
    // Call function
    const result = await createSubmission(testSubmission);
    
    // Verify first approach failed and fallback was used
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.values).toHaveBeenCalledWith({
      assignmentId: 1,
      userId: 1,
      fileUrl: undefined,
      fileName: undefined,
      content: undefined,
      notes: undefined,
      status: 'pending'
    });
    
    // Verify fallback SQL was executed
    expect(mockDb.execute).toHaveBeenCalled();
    expect(result).toEqual({ id: 1, assignmentId: 1, userId: 1, status: 'pending' });
  });
  
  it('should handle database column errors in listSubmissionsForAssignment', async () => {
    // Mock db.select().from().where().orderBy() to throw error
    mockDb.orderBy.mockImplementationOnce(() => {
      throw new Error('column "mime_type" does not exist');
    });
    
    // Create the function with error handling
    const listSubmissionsForAssignment = async (assignmentId: number): Promise<Submission[]> => {
      try {
        const result = await mockDb.select()
          .from('submissions')
          .where(eq('submissions.assignmentId', assignmentId))
          .orderBy(desc('submissions.createdAt'));
        return result;
      } catch (error) {
        console.error("Error listing submissions for assignment:", error);
        
        // Fallback approach with raw SQL if there's a schema issue
        try {
          const sql = `
            SELECT * FROM submissions 
            WHERE assignment_id = ${assignmentId}
            ORDER BY created_at DESC;
          `;
          
          const result = await mockDb.execute(sql);
          return result.rows as Submission[];
        } catch (innerError) {
          console.error("Fallback query also failed:", innerError);
          return [];
        }
      }
    };
    
    // Call function
    const result = await listSubmissionsForAssignment(1);
    
    // Verify first approach failed
    expect(mockDb.select).toHaveBeenCalled();
    expect(mockDb.from).toHaveBeenCalledWith('submissions');
    
    // Verify fallback SQL was executed
    expect(mockDb.execute).toHaveBeenCalled();
    
    // Verify we got results from the fallback
    expect(result).toEqual([{ id: 1, assignmentId: 1, userId: 1, status: 'pending' }]);
  });
  
  it('should handle database column errors in getLatestSubmission', async () => {
    // Mock db.select().from().where().orderBy().limit() to throw error
    mockDb.limit.mockImplementationOnce(() => {
      throw new Error('column "mime_type" does not exist');
    });
    
    // Create the function with error handling
    const getLatestSubmission = async (userId: number, assignmentId: number): Promise<Submission | undefined> => {
      try {
        const [submission] = await mockDb.select()
          .from('submissions')
          .where(and(
            eq('submissions.userId', userId),
            eq('submissions.assignmentId', assignmentId)
          ))
          .orderBy(desc('submissions.createdAt'))
          .limit(1);
        
        return submission;
      } catch (error) {
        console.error("Error getting latest submission:", error);
        
        // Fallback approach with raw SQL if there's a schema issue
        try {
          const sql = `
            SELECT * FROM submissions 
            WHERE user_id = ${userId} 
            AND assignment_id = ${assignmentId}
            ORDER BY created_at DESC
            LIMIT 1;
          `;
          
          const result = await mockDb.execute(sql);
          return result.rows[0] as Submission | undefined;
        } catch (innerError) {
          console.error("Fallback query also failed:", innerError);
          return undefined;
        }
      }
    };
    
    // Call function
    const result = await getLatestSubmission(1, 1);
    
    // Verify first approach failed
    expect(mockDb.select).toHaveBeenCalled();
    expect(mockDb.from).toHaveBeenCalledWith('submissions');
    
    // Verify fallback SQL was executed
    expect(mockDb.execute).toHaveBeenCalled();
    
    // Verify we got results from the fallback
    expect(result).toEqual({ id: 1, assignmentId: 1, userId: 1, status: 'pending' });
  });
  
  it('should handle both primary and fallback failures gracefully', async () => {
    // Force both primary query and fallback to fail
    mockDb.limit.mockImplementationOnce(() => {
      throw new Error('column "mime_type" does not exist');
    });
    
    // Make the fallback fail too
    mockDb.execute.mockImplementationOnce(() => {
      throw new Error('syntax error in SQL');
    });
    
    // Create the function with error handling
    const getLatestSubmission = async (userId: number, assignmentId: number): Promise<Submission | undefined> => {
      try {
        const [submission] = await mockDb.select()
          .from('submissions')
          .where(and(
            eq('submissions.userId', userId),
            eq('submissions.assignmentId', assignmentId)
          ))
          .orderBy(desc('submissions.createdAt'))
          .limit(1);
        
        return submission;
      } catch (error) {
        console.error("Error getting latest submission:", error);
        
        // Fallback approach with raw SQL if there's a schema issue
        try {
          const sql = `
            SELECT * FROM submissions 
            WHERE user_id = ${userId} 
            AND assignment_id = ${assignmentId}
            ORDER BY created_at DESC
            LIMIT 1;
          `;
          
          const result = await mockDb.execute(sql);
          return result.rows[0] as Submission | undefined;
        } catch (innerError) {
          console.error("Fallback query also failed:", innerError);
          return undefined;
        }
      }
    };
    
    // Call function
    const result = await getLatestSubmission(1, 1);
    
    // Verify both approaches failed
    expect(mockDb.select).toHaveBeenCalled();
    expect(mockDb.execute).toHaveBeenCalled();
    
    // Verify we got undefined when all approaches fail
    expect(result).toBeUndefined();
  });
  
  it('should create a submission with safe parameters', async () => {
    // Mock successful submission creation
    mockDb.returning.mockReturnValueOnce([{ 
      id: 1, 
      assignmentId: 1, 
      userId: 1,
      fileUrl: 'test.txt',
      fileName: 'test.txt',
      content: 'Test content',
      notes: 'Test notes', 
      status: 'pending' 
    }]);
    
    // Create the submission function with error handling
    const createSubmission = async (insertSubmission: InsertSubmission): Promise<Submission> => {
      try {
        // Create a new object with only the known fields to avoid column errors
        const safeSubmission = {
          assignmentId: insertSubmission.assignmentId,
          userId: insertSubmission.userId,
          fileUrl: insertSubmission.fileUrl,
          fileName: insertSubmission.fileName,
          content: insertSubmission.content,
          notes: insertSubmission.notes,
          status: insertSubmission.status || 'pending',
        };
        
        const [submission] = await mockDb.insert().values(safeSubmission).returning();
        return submission;
      } catch (error) {
        console.error("Error creating submission:", error);
        
        // Fallback approach with raw SQL if there's a schema issue
        const sql = `
          INSERT INTO submissions (assignment_id, user_id, file_url, file_name, content, notes, status)
          VALUES (
            ${insertSubmission.assignmentId}, 
            ${insertSubmission.userId}, 
            ${insertSubmission.fileUrl ? `'${insertSubmission.fileUrl}'` : 'NULL'},
            ${insertSubmission.fileName ? `'${insertSubmission.fileName}'` : 'NULL'},
            ${insertSubmission.content ? `'${insertSubmission.content}'` : 'NULL'},
            ${insertSubmission.notes ? `'${insertSubmission.notes}'` : 'NULL'},
            '${insertSubmission.status || 'pending'}'
          )
          RETURNING *;
        `;
        
        const result = await mockDb.execute(sql);
        return result.rows[0] as Submission;
      }
    };
    
    // Test with a complete submission
    const testSubmission: InsertSubmission = {
      assignmentId: 1,
      userId: 1,
      fileUrl: 'test.txt',
      fileName: 'test.txt',
      content: 'Test content',
      notes: 'Test notes',
      status: 'pending'
    };
    
    // Call function
    const result = await createSubmission(testSubmission);
    
    // Verify safe submission was created
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.values).toHaveBeenCalledWith({
      assignmentId: 1,
      userId: 1,
      fileUrl: 'test.txt',
      fileName: 'test.txt',
      content: 'Test content',
      notes: 'Test notes',
      status: 'pending'
    });
    
    // Verify fallback was not used
    expect(mockDb.execute).not.toHaveBeenCalled();
    
    // Verify result
    expect(result).toEqual({ 
      id: 1, 
      assignmentId: 1, 
      userId: 1,
      fileUrl: 'test.txt',
      fileName: 'test.txt',
      content: 'Test content',
      notes: 'Test notes', 
      status: 'pending' 
    });
  });
});