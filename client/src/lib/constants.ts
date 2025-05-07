export const API_ROUTES = {
  LOGIN: '/api/auth/login',
  LOGOUT: '/api/auth/logout',
  USER: '/api/auth/user',
  ASSIGNMENTS: '/api/assignments',
  SUBMISSIONS: '/api/submissions',
  FEEDBACK: '/api/feedback',
  STUDENTS: '/api/students',
  EXPORT_CSV: '/api/export/grades',
};

export const APP_ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  ASSIGNMENTS: '/assignments',
  SUBMISSION: (id: string | number) => `/submission/${id}`,
  INSTRUCTOR_DASHBOARD: '/instructor/dashboard',
  INSTRUCTOR_ASSIGNMENT: (id: string | number) => `/instructor/assignment/${id}`,
};

export const FILE_TYPES = {
  ALLOWED: ['.py', '.java', '.cpp', '.ipynb', '.zip', '.js', '.ts', '.html', '.css', '.md', '.txt'],
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
};

export const SUBMISSION_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

export const USER_ROLES = {
  STUDENT: 'student',
  INSTRUCTOR: 'instructor',
};

export const FEEDBACK_TYPE = {
  STRENGTHS: 'strengths',
  IMPROVEMENTS: 'improvements',
  SUGGESTIONS: 'suggestions',
};
