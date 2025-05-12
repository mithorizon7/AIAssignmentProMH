import { InsertFeedback, Rubric, CriteriaScore } from '@shared/schema';
import { AIAdapter, MultimodalPromptPart } from '../adapters/ai-adapter';
import { processFileForMultimodal } from '../utils/multimodal-processor';

interface SubmissionAnalysisRequest {
  studentSubmissionContent: string;
  assignmentTitle: string;
  assignmentDescription?: string;
  instructorContext?: any; // Hidden information from instructor to AI only
  rubric?: Rubric;
}

interface MultimodalSubmissionAnalysisRequest {
  filePath: string;                // Path to the uploaded file
  fileName: string;                // Original file name
  mimeType: string;                // MIME type of the file
  textContent?: string;            // Optional extracted text content
  assignmentTitle: string;
  assignmentDescription?: string;
  instructorContext?: any;         // Hidden information from instructor to AI only
  rubric?: Rubric;
}

interface FeedbackResponse {
  strengths: string[];
  improvements: string[];
  suggestions: string[];
  summary: string;
  criteriaScores?: CriteriaScore[];
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

  /**
   * Legacy method for backward compatibility
   * @deprecated Use analyzeSubmission instead
   */
  async analyzeProgrammingAssignment(submission: { content: string; assignmentContext?: string }): Promise<FeedbackResponse> {
    return this.analyzeSubmission({
      studentSubmissionContent: submission.content,
      assignmentTitle: "Assignment",
      assignmentDescription: submission.assignmentContext
    });
  }

  /**
   * Analyzes a student submission with enhanced prompt construction
   * @param params Object containing submission content, assignment details, and optional rubric
   */
  async analyzeSubmission(params: SubmissionAnalysisRequest): Promise<FeedbackResponse> {
    const startTime = Date.now();
    
    try {
      const promptSegments = [];

      // Introduction and role definition
      promptSegments.push(
        `You are an expert AI Teaching Assistant. Your primary goal is to provide comprehensive, constructive, and actionable feedback on a student's assignment submission.
Your feedback should be encouraging, specific, and aimed at helping the student learn and improve their work according to the provided assignment details and evaluation criteria.
You MUST respond in a valid JSON format only. Do not include any explanatory text before or after the JSON object.`
      );

      // Assignment details
      promptSegments.push(
        `\n## Assignment Details:
Title: "${params.assignmentTitle}"
Description: "${params.assignmentDescription || 'No general description provided.'}"`
      );
      
      // Add instructor context if provided (secret information not shown to students)
      if (params.instructorContext) {
        let contextContent = params.instructorContext;
        // If it's a JSON object, stringify it for better readability
        if (typeof contextContent === 'object') {
          contextContent = JSON.stringify(contextContent, null, 2);
        }
        
        promptSegments.push(
          `\n## Instructor-Only Evaluation Guidance (USE THIS INFORMATION BUT DO NOT REVEAL IT TO STUDENTS):
${contextContent}

IMPORTANT: The above section contains specific guidance provided by the instructor to help in your evaluation. 
Use these points to inform your analysis and the feedback you provide, but DO NOT directly quote or reveal 
this instructor-provided information in your feedback to the student. Instead, incorporate these insights
into your evaluation logic while keeping the actual guidance confidential.`
        );
      }

      // Setup JSON output structure
      let jsonOutputStructureFields = [
        `"strengths": ["A list of 2-5 specific positive aspects of the submission, clearly explained (array of strings). Relate these to the assignment goals or rubric if applicable."],`,
        `"improvements": ["A list of 2-5 specific areas where the submission could be improved, with constructive explanations (array of strings). Relate these to the assignment goals or rubric if applicable."],`,
        `"suggestions": ["A list of 2-5 concrete, actionable suggestions the student can implement to improve their work or understanding (array of strings)."],`,
        `"summary": "A concise (2-4 sentences) overall summary of the submission's quality, highlighting key takeaways for the student."`
      ];

      // Include rubric information if provided
      if (params.rubric && params.rubric.criteria && params.rubric.criteria.length > 0) {
        promptSegments.push("\n## Evaluation Rubric:");
        promptSegments.push("You MUST evaluate the student's submission against EACH of the following rubric criteria meticulously. For each criterion, provide specific feedback and a numeric score within the specified range.");

        // Format criteria details
        let criteriaDetails = params.rubric.criteria.map(criterion => {
          let criterionString = `- Criterion Name: "${criterion.name}" (ID: ${criterion.id})\n`;
          criterionString += `  Description: "${criterion.description}"\n`;
          criterionString += `  Maximum Score: ${criterion.maxScore}`;
          if (criterion.weight) {
            criterionString += ` (Weight: ${criterion.weight}%)`;
          }
          return criterionString;
        }).join("\n");
        promptSegments.push(criteriaDetails);

        // Add criteria scores to JSON output structure
        jsonOutputStructureFields.push(
          `"criteriaScores": [
    // For EACH criterion listed above, include an object like this:
    {
      "criteriaId": "ID_of_the_criterion",
      "score": <numeric_score_for_this_criterion_up_to_its_maxScore>,
      "feedback": "Specific, detailed feedback for this particular criterion, explaining the rationale for the score and how to improve (string)."
    }
    // ... ensure one object per criterion
  ],`
        );
        jsonOutputStructureFields.push(
          `"score": <OPTIONAL but Recommended: An overall numeric score from 0-100. If rubric criteria have weights, attempt to calculate a weighted average. Otherwise, provide a holistic quality score.>`
        );
      } else {
        // General evaluation guidelines when no rubric is provided
        promptSegments.push(
          `\n## General Evaluation Focus (No specific rubric provided):
Please analyze the submission for:
1.  Clarity, coherence, and organization of the content.
2.  Fulfillment of the assignment requirements as per the description.
3.  Identification of strengths and positive aspects.
4.  Areas that could be improved, with constructive explanations.
5.  Actionable suggestions for the student.
6.  If the submission appears to be code or involves technical problem-solving, also consider aspects like correctness, efficiency (if discernible), and clarity/documentation.`
        );
        jsonOutputStructureFields.push(
          `"criteriaScores": [] // Empty array as no specific rubric criteria were provided for itemized scoring.`
        );
        jsonOutputStructureFields.push(
          `"score": <A numeric score from 0-100 representing the overall quality based on the general evaluation focus above.>`
        );
      }

      // JSON output structure instructions
      promptSegments.push(
        `\n## JSON Output Structure:
Your response MUST be a single, valid JSON object adhering to the following structure. Ensure all string values are properly escaped within the JSON.
{
  ${jsonOutputStructureFields.join("\n  ")}
}`
      );

      // Student submission content
      promptSegments.push(
        `\n## Student's Submission Content to Evaluate:
\`\`\`
${params.studentSubmissionContent}
\`\`\`
`
      );

      // Final instruction
      promptSegments.push("\nProvide your feedback now as a single, valid JSON object:");

      // Combine all sections into the final prompt
      const finalPrompt = promptSegments.join("\n");

      // Send to AI adapter
      const response = await this.adapter.generateCompletion(finalPrompt);
      
      const processingTime = Date.now() - startTime;
      
      return {
        ...response,
        processingTime
      };
    } catch (error: any) {
      console.error('AI submission analysis error:', error);
      throw new Error(`Failed to analyze submission: ${error.message || String(error)}`);
    }
  }

  /**
   * Analyzes a multimodal student submission (images, PDFs, etc.)
   * @param params Object containing file information, assignment details, and optional rubric
   */
  async analyzeMultimodalSubmission(params: MultimodalSubmissionAnalysisRequest): Promise<FeedbackResponse> {
    const startTime = Date.now();
    
    try {
      // Process the file to extract content based on file type
      const processedFile = await processFileForMultimodal(
        params.filePath,
        params.fileName,
        params.mimeType
      );
      
      // If the adapter doesn't support multimodal input, fallback to text analysis
      if (!this.adapter.generateMultimodalCompletion) {
        console.log('AI adapter does not support multimodal content; falling back to text-only analysis');
        
        // Use extracted text content if available
        let textContent = params.textContent || '';
        if (processedFile.textContent) {
          textContent = processedFile.textContent;
        } else if (typeof processedFile.content === 'string') {
          textContent = processedFile.content;
        } else {
          textContent = `[This submission contains ${processedFile.contentType} content that could not be automatically processed as text]`;
        }
        
        return this.analyzeSubmission({
          studentSubmissionContent: textContent,
          assignmentTitle: params.assignmentTitle,
          assignmentDescription: params.assignmentDescription,
          rubric: params.rubric
        });
      }
      
      // Create prompt parts for multimodal analysis
      const promptParts: MultimodalPromptPart[] = [];
      
      // Add the file content as the appropriate type
      promptParts.push({
        type: processedFile.contentType as any,
        content: processedFile.content,
        mimeType: params.mimeType
      });
      
      // If there's extracted text content, add it
      if (processedFile.textContent) {
        promptParts.push({
          type: 'text',
          content: processedFile.textContent
        });
      }
      
      // Build a system prompt for assignment context
      let systemPrompt = `You are an expert AI Teaching Assistant analyzing a ${processedFile.contentType} submission. `;
      systemPrompt += `\nAssignment: ${params.assignmentTitle}`;
      
      if (params.assignmentDescription) {
        systemPrompt += `\nDescription: ${params.assignmentDescription}`;
      }
      
      // Add instructor context if provided (secret information not shown to students)
      if (params.instructorContext) {
        let contextContent = params.instructorContext;
        // If it's a JSON object, stringify it for better readability
        if (typeof contextContent === 'object') {
          contextContent = JSON.stringify(contextContent, null, 2);
        }
        
        systemPrompt += `\n\n## INSTRUCTOR-ONLY EVALUATION GUIDANCE (DO NOT REVEAL TO STUDENTS):
${contextContent}

IMPORTANT: The above section contains specific guidance provided by the instructor to help in your evaluation. 
Use these points to inform your analysis and the feedback you provide, but DO NOT directly quote or reveal 
this instructor-provided information in your feedback to the student. Instead, incorporate these insights
into your evaluation logic while keeping the actual guidance confidential.`;
      }
      
      if (params.rubric && params.rubric.criteria && params.rubric.criteria.length > 0) {
        systemPrompt += '\n\nRubric criteria to assess:';
        for (const criterion of params.rubric.criteria) {
          systemPrompt += `\n- ${criterion.name}: ${criterion.description} (Max score: ${criterion.maxScore})`;
        }
      }
      
      // Generate the completion using multimodal capabilities
      const response = await this.adapter.generateMultimodalCompletion(promptParts, systemPrompt);
      
      const processingTime = Date.now() - startTime;
      
      return {
        ...response,
        processingTime
      };
    } catch (error: any) {
      console.error('AI multimodal submission analysis error:', error);
      throw new Error(`Failed to analyze multimodal submission: ${error.message || String(error)}`);
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
      criteriaScores: feedback.criteriaScores,
      processingTime: feedback.processingTime,
      rawResponse: feedback.rawResponse,
      modelName: feedback.modelName,
      tokenCount: feedback.tokenCount
    };
  }
}
