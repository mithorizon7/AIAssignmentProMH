import { rest } from 'msw';

// Mock API handlers for testing
export const handlers = [
  // Auth endpoints
  rest.get('/api/auth/user', (req, res, ctx) => {
    // Mock authenticated user
    return res(
      ctx.status(200),
      ctx.json({
        id: 1,
        username: 'testuser',
        name: 'Test User',
        email: 'test@example.com',
        role: 'instructor',
      })
    );
  }),
  
  rest.post('/api/auth/login', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        id: 1,
        username: 'testuser',
        name: 'Test User',
        email: 'test@example.com',
        role: 'instructor',
      })
    );
  }),
  
  // Assignments endpoints
  rest.get('/api/assignments', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        {
          id: 1,
          title: 'Test Assignment 1',
          description: 'Description for test assignment 1',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          courseId: 1,
          rubric: 'Test rubric',
          status: 'active',
        },
        {
          id: 2,
          title: 'Test Assignment 2',
          description: 'Description for test assignment 2',
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          courseId: 1,
          rubric: 'Test rubric',
          status: 'active',
        },
      ])
    );
  }),
  
  // Submissions endpoints
  rest.get('/api/submissions', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        {
          id: 1,
          userId: 1,
          assignmentId: 1,
          filePath: '/uploads/test.pdf',
          fileType: 'application/pdf',
          fileSize: 1024,
          status: 'completed',
          createdAt: new Date().toISOString(),
        },
      ])
    );
  }),
  
  // Mock API response for feedback
  rest.get('/api/submissions/:id/feedback', (req, res, ctx) => {
    const submissionId = req.params.id;
    
    return res(
      ctx.status(200),
      ctx.json({
        id: 1,
        submissionId: Number(submissionId),
        strengths: ['Good organization', 'Clear communication'],
        improvements: ['Could improve citations', 'More depth in analysis'],
        suggestions: ['Consider expanding on section 2', 'Add more examples'],
        summary: 'Overall good work with room for improvement',
        score: 85,
        createdAt: new Date().toISOString(),
      })
    );
  }),
  
  // Courses endpoints
  rest.get('/api/courses', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        {
          id: 1,
          name: 'Test Course 1',
          description: 'Description for test course 1',
          code: 'TC101',
          createdAt: new Date().toISOString(),
        },
        {
          id: 2,
          name: 'Test Course 2',
          description: 'Description for test course 2',
          code: 'TC102',
          createdAt: new Date().toISOString(),
        },
      ])
    );
  }),
];