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
    ADMIN_USERS: '/api/admin/users',
    SYSTEM_SETTINGS: '/api/admin/system-settings',
    SECURITY_AUDIT: '/api/admin/security-audit',
    NEWSLETTER_SUBSCRIBE: '/api/newsletter/subscribe',
  };

  export const APP_ROUTES = {
    HOME: '/',
    LOGIN: '/login',
    DASHBOARD: '/dashboard',
    ASSIGNMENTS: '/assignments',
    SUBMISSION: (id: string | number) => `/submission/${id}`,
    SUBMISSIONS: '/submissions',
    SUBMISSION_HISTORY: '/history',
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
    ADMIN_SETTINGS: '/admin/system-config', // Note: Same as ADMIN_SYSTEM_CONFIG, verify if intended
    ADMIN_LOGS: '/admin/logs',
  };

  export const FILE_TYPES = {
    // Code files
    CODE: ['.py', '.java', '.cpp', '.c', '.cs', '.js', '.ts', '.jsx', '.tsx', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.html', '.css', '.scss', '.less'],

    // Documents
    DOCUMENT: ['.txt', '.md', '.doc', '.docx', '.rtf', '.odt', '.pdf'],

    // Data/Spreadsheets
    DATA: ['.csv', '.xls', '.xlsx', '.ods', '.json', '.xml', '.ipynb'],

    // Archives
    ARCHIVE: ['.zip', '.rar', '.tar', '.gz', '.7z'],

    // Images
    IMAGE: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.tif', '.ico', '.psd', '.raw', '.heic', '.heif'],

    // Audio
    AUDIO: ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma', '.opus'],

    // Video
    VIDEO: ['.mp4', '.webm', '.avi', '.mov', '.wmv', '.mkv', '.flv', '.m4v', '.3gp', '.mpg', '.mpeg'],

    // All allowed types combined
    ALLOWED: [
      // Code files
      '.py', '.java', '.cpp', '.c', '.cs', '.js', '.ts', '.jsx', '.tsx', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.html', '.css', '.scss', '.less',

      // Documents
      '.txt', '.md', '.doc', '.docx', '.rtf', '.odt', '.pdf',

      // Data/Spreadsheets
      '.csv', '.xls', '.xlsx', '.ods', '.json', '.xml', '.ipynb',

      // Archives
      '.zip', '.rar', '.tar', '.gz', '.7z',

      // Images - ALL MAJOR FORMATS
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.tif', '.ico', '.psd', '.raw', '.heic', '.heif',

      // Audio
      '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma', '.opus',

      // Video
      '.mp4', '.webm', '.avi', '.mov', '.wmv', '.mkv', '.flv', '.m4v', '.3gp', '.mpg', '.mpeg',

      // Additional document formats
      '.pages', '.key', '.numbers', '.epub', '.mobi', '.azw3',

      // Design files
      '.ai', '.sketch', '.fig', '.xd', '.indd',

      // 3D files
      '.obj', '.fbx', '.dae', '.blend', '.max', '.ma', '.mb',

      // Presentation files
      '.ppt', '.pptx', '.odp',

      // Database files
      '.db', '.sqlite', '.sqlite3', '.mdb',

      // Configuration files
      '.yml', '.yaml', '.toml', '.ini', '.cfg', '.conf',

      // Log files
      '.log', '.out', '.err'
    ],

    // File size limits based on content type (in bytes)
    MAX_SIZE: 50 * 1024 * 1024, // 50MB for general files
    MAX_IMAGE_SIZE: 50 * 1024 * 1024, // 50MB for images
    MAX_AUDIO_SIZE: 100 * 1024 * 1024, // 100MB for audio files
    MAX_VIDEO_SIZE: 500 * 1024 * 1024, // 500MB for video files
    MAX_DOCUMENT_SIZE: 100 * 1024 * 1024, // 100MB for documents
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

  // FEEDBACK_TYPE and RUBRIC_CRITERIA_TYPE have been moved to shared/enums.ts
  // Import them from there in your components