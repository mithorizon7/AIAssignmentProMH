/**
 * Shared enum types for use across both client and server
 */

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

export type FeedbackTypeKey = keyof typeof FEEDBACK_TYPE;
export type FeedbackTypeValue = typeof FEEDBACK_TYPE[FeedbackTypeKey];

export type RubricCriteriaTypeKey = keyof typeof RUBRIC_CRITERIA_TYPE;
export type RubricCriteriaTypeValue = typeof RUBRIC_CRITERIA_TYPE[RubricCriteriaTypeKey];