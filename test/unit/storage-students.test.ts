import { describe, it, expect, vi } from 'vitest';
import { DatabaseStorage } from '../../server/storage';

// Mock the database client
vi.mock('../../server/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([
      { id: 1, name: 'Alice', email: 'alice@example.com', role: 'student' }
    ]),
  }
}));

describe('DatabaseStorage.listStudents', () => {
  it('should return students with role student', async () => {
    const storage = new DatabaseStorage();
    const students = await storage.listStudents();
    expect(students.length).toBe(1);
    expect(students[0].name).toBe('Alice');
  });
});
