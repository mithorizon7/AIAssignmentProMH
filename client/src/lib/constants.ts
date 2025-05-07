export const API_ROUTES = {
  LOGIN: '/api/auth/login',
  LOGOUT: '/api/auth/logout',
  USER: '/api/auth/user',
  ASSIGNMENTS: '/api/assignments',
  SUBMISSIONS: '/api/submissions',
  FEEDBACK: '/api/feedback',
  STUDENTS: '/api/students',
  EXPORT_CSV: '/api/export/grades',
  COURSES: '/api/courses',
};

export const APP_ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  ASSIGNMENTS: '/assignments',
  SUBMISSION: (id: string | number) => `/submission/${id}`,
  SUBMISSIONS: '/submissions',
  INSTRUCTOR_DASHBOARD: '/instructor/dashboard',
  INSTRUCTOR_ASSIGNMENT: (id: string | number) => `/instructor/assignment/${id}`,
  INSTRUCTOR_CREATE_ASSIGNMENT: '/instructor/create-assignment',
  INSTRUCTOR_COURSES: '/instructor/courses',
  INSTRUCTOR_COURSE: (id: string | number) => `/instructor/course/${id}`,
  INSTRUCTOR_COURSE_STUDENTS: (id: string | number) => `/instructor/course/${id}/students`,
  INSTRUCTOR_COURSE_EDIT: (id: string | number) => `/instructor/course/${id}/edit`,
  INSTRUCTOR_ANALYTICS: '/instructor/analytics',
  SUBMIT_BY_CODE: (code: string) => `/submit/${code}`,
  ADMIN_DASHBOARD: '/admin/dashboard',
  ADMIN_USERS: '/admin/users',
  ADMIN_SYSTEM_CONFIG: '/admin/system-config',
  ADMIN_SETTINGS: '/admin/system-config',
  ADMIN_LOGS: '/admin/logs',
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
  ADMIN: 'admin',
};

export const FEEDBACK_TYPE = {
  STRENGTHS: 'strengths',
  IMPROVEMENTS: 'improvements',
  SUGGESTIONS: 'suggestions',
};

export const RUBRIC_CRITERIA_TYPE = {
  CODE_QUALITY: 'code_quality',
  FUNCTIONALITY: 'functionality',
  DESIGN: 'design',
  DOCUMENTATION: 'documentation',
  CREATIVITY: 'creativity',
  PROBLEM_SOLVING: 'problem_solving',
  TESTING: 'testing',
  COMPLETENESS: 'completeness',
  OTHER: 'other',
};
