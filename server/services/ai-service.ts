import { InsertFeedback } from '@shared/schema';
import { AIAdapter } from '../adapters/openai-adapter';

interface AnalysisRequest {
  content: string;
  assignmentContext?: string;
}

interface FeedbackResponse {
  strengths: string[];
  improvements: string[];
  suggestions: string[];
  summary: string;
  score?: number;
  processingTime: number;
  rawResponse: Record<string, any>;
  modelName: string;
  tokenCount: number;
}

export class AIService {
  private adapter: AIAdapter;

  constructor(adapter: AIAdapter) {
    this.adapter = adapter;
  }

  async analyzeProgrammingAssignment(submission: AnalysisRequest): Promise<FeedbackResponse> {
    const startTime = Date.now();
    
    try {
      const promptContext = `
You are an AI teaching assistant that provides helpful, constructive feedback on programming assignments. 
You are analyzing a student's submission for a programming assignment. 
${submission.assignmentContext ? `Assignment context: ${submission.assignmentContext}` : ''}

Analyze the code for:
1. Correctness of implementation
2. Code quality and organization
3. Algorithm efficiency and time complexity
4. Best practices
5. Edge case handling

Respond with constructive feedback in JSON format with these sections:
- strengths: A list of 2-4 key strengths in the submission (as array of strings)
- improvements: A list of 2-4 areas that need improvement (as array of strings)
- suggestions: A list of 2-4 specific suggestions to make the code better (as array of strings)
- summary: A short 2-3 sentence summary of the overall assessment
- score: A numeric score from 0-100 representing the quality of the submission

Here is the student's submission:
\`\`\`
${submission.content}
\`\`\`
      `;

      const response = await this.adapter.generateCompletion(promptContext);
      
      const processingTime = Date.now() - startTime;
      
      return {
        ...response,
        processingTime
      };
    } catch (error) {
      console.error('AI analysis error:', error);
      throw new Error(`Failed to analyze submission: ${error.message}`);
    }
  }

  async prepareFeedbackForStorage(submissionId: number, feedback: FeedbackResponse): Promise<InsertFeedback> {
    return {
      submissionId,
      strengths: feedback.strengths,
      improvements: feedback.improvements,
      suggestions: feedback.suggestions,
      summary: feedback.summary,
      score: feedback.score,
      processingTime: feedback.processingTime,
      rawResponse: feedback.rawResponse,
      modelName: feedback.modelName,
      tokenCount: feedback.tokenCount
    };
  }
}
