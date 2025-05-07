import { SUBMISSION_STATUS, USER_ROLES, FEEDBACK_TYPE } from './constants';

export interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  role: typeof USER_ROLES[keyof typeof USER_ROLES];
  createdAt: string;
}

export interface Course {
  id: number;
  name: string;
  code: string;
  description: string;
}

export interface Assignment {
  id: number;
  title: string;
  description: string;
  courseId: number;
  course: Course;
  dueDate: string;
  status: 'active' | 'completed' | 'upcoming';
  createdAt: string;
  updatedAt: string;
}

export interface Submission {
  id: number;
  assignmentId: number;
  userId: number;
  user?: User;
  assignment?: Assignment;
  fileUrl?: string;
  fileName?: string;
  content?: string;
  notes?: string;
  status: typeof SUBMISSION_STATUS[keyof typeof SUBMISSION_STATUS];
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackItem {
  type: typeof FEEDBACK_TYPE[keyof typeof FEEDBACK_TYPE];
  content: string;
}

export interface Feedback {
  id: number;
  submissionId: number;
  submission?: Submission;
  strengths: string[];
  improvements: string[];
  suggestions: string[];
  summary: string;
  score?: number;
  processingTime: number;
  createdAt: string;
}

export interface SubmissionWithFeedback extends Submission {
  feedback?: Feedback;
}

export interface AssignmentWithSubmissions extends Assignment {
  submissions?: Submission[];
  submissionCount?: number;
  lastSubmission?: Submission;
}

export interface StudentProgress {
  id: number;
  name: string;
  email: string;
  status: 'submitted' | 'not_submitted' | 'needs_review';
  lastSubmission?: string;
  attempts: number;
}

export interface AssignmentStats {
  submittedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  totalCount: number;
  submissionPercentage: number;
}

export interface SubmissionTimeline {
  date: string;
  count: number;
}

export interface AnalyticsData {
  assignmentStats: AssignmentStats;
  submissionTimeline: SubmissionTimeline[];
  avgFeedbackTime: number;
  avgRevisionsPerStudent: number;
  avgImprovementPercentage: number;
}
