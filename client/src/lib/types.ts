import { SUBMISSION_STATUS, USER_ROLES } from './constants';
import { FEEDBACK_TYPE, RUBRIC_CRITERIA_TYPE, FeedbackTypeValue, RubricCriteriaTypeValue } from '@shared/enums';

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

export interface RubricCriteria {
  id: string;
  type: typeof RUBRIC_CRITERIA_TYPE[keyof typeof RUBRIC_CRITERIA_TYPE];
  name: string;
  description: string;
  maxScore: number;
  weight: number; // percentage weight in the overall assignment grade
}

export interface Rubric {
  criteria: RubricCriteria[];
  totalPoints: number;
  passingThreshold?: number; // minimum percentage to pass
}

export interface Assignment {
  id: number;
  title: string;
  description: string;
  courseId: number;
  course: Course;
  dueDate: string;
  status: 'active' | 'completed' | 'upcoming';
  shareableCode?: string;
  rubric?: Rubric;
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

export interface CriteriaScore {
  criteriaId: string;
  score: number;
  feedback: string;
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
  criteriaScores?: CriteriaScore[];
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
