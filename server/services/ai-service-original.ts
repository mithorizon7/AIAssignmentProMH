import { InsertFeedback, Rubric, CriteriaScore, InstructorContext } from '@shared/schema';
import { AIAdapter, MultimodalPromptPart } from '../adapters/ai-adapter';
import { processFileForMultimodal } from '../utils/multimodal-processor';
import { ContentType, determineContentType } from '../utils/file-type-settings';

interface SubmissionAnalysisRequest {
  studentSubmissionContent: string;
  assignmentTitle: string;
  assignmentDescription?: string;
  instructorContext?: InstructorContext; // Hidden information from instructor to AI only
  rubric?: Rubric;
}

interface MultimodalSubmissionAnalysisRequest {
  filePath?: string;               // Path to the uploaded file (optional if fileBuffer is provided)
  fileBuffer?: Buffer;             // Buffer with file content (optional if filePath is provided)
  fileDataUri?: string;            // Data URI representation of the file (for small images)
  fileName: string;                // Original file name
  mimeType: string;                // MIME type of the file
  textContent?: string;            // Optional extracted text content
  assignmentTitle: string;
  assignmentDescription?: string;
  instructorContext?: InstructorContext; // Hidden information from instructor to AI only
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
  rawResponse: Record<string, unknown>;
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
  async generateFeedback(
    content: string, 
    assignmentTitle: string, 
    assignmentDescription?: string
  ): Promise<FeedbackResponse> {
    return this.analyzeSubmission({
      studentSubmissionContent: content,
      assignmentTitle,
      assignmentDescription
    });
  }

  /**
   * Analyzes a student submission and provides feedback based on the assignment context
   * @param params Object containing the submission content, assignment details, and optional rubric
   */
  async analyzeSubmission(params: SubmissionAnalysisRequest): Promise<FeedbackResponse> {
    const startTime = Date.now();
    
    try {
      // Create the prompt for the AI with system guidance and student submission
      const systemPrompt = this.createSystemPrompt(params);
            
      // Generate the completion
      const response = await this.adapter.generateCompletion(params.studentSubmissionContent, systemPrompt);
      
      const processingTime = Date.now() - startTime;
      
      return {
        ...response,
        processingTime
      };
    } catch (error: unknown) {
      console.error('[AIService] AI submission analysis error:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to analyze submission: ${error.message}`);
      } else {
        throw new Error(`Failed to analyze submission: ${String(error)}`);
      }
    }
  }

  /**
   * Analyzes a multimodal student submission (images, PDFs, etc.)
   * @param params Object containing file information, assignment details, and optional rubric
   */
  async analyzeMultimodalSubmission(params: MultimodalSubmissionAnalysisRequest): Promise<FeedbackResponse> {
    const startTime = Date.now();
    
    try {
      console.log(`[AIService] Analyzing multimodal submission: ${params.fileName} (${params.mimeType})`);
      
      let processedFile;
      
      // Handle file data in different forms (data URI, buffer, or path)
      if (params.fileDataUri && params.mimeType.startsWith('image/')) {
        // Use data URI for small images for reliable processing
        console.log(`[AIService] Processing image from data URI`);
        let contentType: ContentType = 'image';
        
        processedFile = {
          content: params.fileDataUri, // Use the data URI directly
          contentType,
          mimeType: params.mimeType,
          textContent: params.textContent
        };
      } else if (params.fileBuffer) {
        console.log(`[AIService] Processing file from buffer (${params.fileBuffer.length} bytes)`);
        // If we have a buffer (from multer memory storage), process it directly
        
        // Determine content type based on MIME type
        let contentType: ContentType = 'image';
        
        if (params.mimeType.startsWith('image/')) {
          contentType = 'image';
        } else if (params.mimeType.startsWith('text/') || 
                  params.mimeType.includes('javascript') || 
                  params.mimeType.includes('json')) {
          contentType = 'text';
        } else if (params.mimeType.includes('pdf') || 
                  params.mimeType.includes('word') || 
                  params.mimeType.includes('excel') || 
                  params.mimeType.includes('powerpoint') || 
                  params.mimeType.includes('document')) {
          contentType = 'document';
        } else if (params.mimeType.startsWith('audio/')) {
          contentType = 'audio';
        } else if (params.mimeType.startsWith('video/')) {
          contentType = 'video';
        }
        
        processedFile = {
          content: params.fileBuffer,
          contentType,
          mimeType: params.mimeType,
          textContent: params.textContent
        };
      } else if (params.filePath) {
        // Process the file from a path
        // This automatically handles both local paths and remote URLs (S3, HTTP)
        processedFile = await processFileForMultimodal(
          params.filePath, 
          params.fileName, 
          params.mimeType
        );
      } else {
        throw new Error('No file content provided (buffer, path, or data URI required)');
      }
      
      // Check if we can use multimodal processing for this file type
      if (!processedFile) {
        console.log(`[AIService] No processed file available, falling back to text analysis`);
        
        // Fall back to text-only analysis
        let textContent = 'No file content could be processed';
        
        return this.analyzeSubmission({
          studentSubmissionContent: textContent,
          assignmentTitle: params.assignmentTitle,
          assignmentDescription: params.assignmentDescription,
          instructorContext: params.instructorContext,
          rubric: params.rubric
        });
      }
      
      // Create prompt parts for multimodal analysis
      const promptParts: MultimodalPromptPart[] = [];
      
      // Add the file content as the appropriate type
      promptParts.push({
        type: processedFile.contentType as ContentType,
        content: processedFile.content,
        mimeType: params.mimeType,
        textContent: processedFile.textContent // Pass through any extracted text content
      });
      
      // Build a system prompt for assignment context with enhanced guidance for multimodal content
      // Following Google's Gemini API best practices from https://ai.google.dev/gemini-api/docs/system-instructions
      // and https://ai.google.dev/gemini-api/docs/image-understanding
      let systemPrompt = `You are an expert AI Teaching Assistant analyzing a ${processedFile.contentType} submission.
Your task is to provide precise, detailed, and constructive feedback on the student's work.

For ${processedFile.contentType === 'image' ? 'image' : processedFile.contentType === 'document' ? 'document' : processedFile.contentType} content:
${processedFile.contentType === 'image' ? 
`- Carefully analyze all visual elements, composition, technical execution, and conceptual aspects
- Pay attention to details such as color, composition, technical execution, and creative choices
- Provide specific feedback that references exact visual elements in the submission
- Evaluate both technical skills and creative/conceptual understanding` : 
processedFile.contentType === 'document' ? 
`- Analyze the document structure, content organization, clarity, and coherence
- Evaluate accuracy, thoroughness, and relevance of information
- Provide specific feedback on writing style, argumentation, and evidence use
- Look for proper citation and reference use when applicable` :
`- Carefully examine both technical correctness and creative aspects
- Consider organization, structure, and presentation quality
- Provide specific feedback referencing exact elements from the submission`}

Respond with a structured assessment including strengths, areas for improvement, and specific suggestions.

Assignment: ${params.assignmentTitle}`;
      
      if (params.assignmentDescription) {
        systemPrompt += `\nDescription: ${params.assignmentDescription}`;
      }
      
      // Add instructor context if provided (secret information not shown to students)
      if (params.instructorContext) {
        let contextContent = params.instructorContext.content;
        
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
      
      console.log(`[AIService] Sending multimodal request to AI adapter with content type: ${processedFile.contentType}`);
      
      // Generate the completion using multimodal capabilities
      const response = await this.adapter.generateMultimodalCompletion(promptParts, systemPrompt);
      
      const processingTime = Date.now() - startTime;
      console.log(`[AIService] Multimodal analysis completed in ${processingTime}ms`);
      
      return {
        ...response,
        processingTime
      };
    } catch (error: unknown) {
      console.error('[AIService] AI multimodal submission analysis error:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to analyze multimodal submission: ${error.message}`);
      } else {
        throw new Error(`Failed to analyze multimodal submission: ${String(error)}`);
      }
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

  /**
   * Helper method to create a system prompt for the AI
   * @param params Object containing submission and assignment details
   */
  private createSystemPrompt(params: SubmissionAnalysisRequest): string {
    let systemPrompt = `You are an expert AI Teaching Assistant analyzing student submissions.
Your task is to provide precise, detailed, and constructive feedback on the student's work.

For each submission, analyze:
- Technical correctness
- Understanding of concepts
- Structure and organization 
- Relevance to the assignment

Respond with a structured assessment including:
- Specific strengths of the submission
- Areas for improvement
- Targeted suggestions for enhancing the work

Assignment: ${params.assignmentTitle}`;

    // Add description if provided
    if (params.assignmentDescription) {
      systemPrompt += `\nDescription: ${params.assignmentDescription}`;
    }
    
    // Add instructor context if provided (secret information not shown to students)
    if (params.instructorContext) {
      let contextContent = params.instructorContext.content;
      
      systemPrompt += `\n\n## INSTRUCTOR-ONLY EVALUATION GUIDANCE (DO NOT REVEAL TO STUDENTS):
${contextContent}

IMPORTANT: The above section contains specific guidance provided by the instructor to help in your evaluation. 
Use these points to inform your analysis and the feedback you provide, but DO NOT directly quote or reveal 
this instructor-provided information in your feedback to the student. Instead, incorporate these insights
into your evaluation logic while keeping the actual guidance confidential.`;
    }
    
    // Add rubric if provided
    if (params.rubric && params.rubric.criteria && params.rubric.criteria.length > 0) {
      systemPrompt += '\n\nRubric criteria to assess:';
      for (const criterion of params.rubric.criteria) {
        systemPrompt += `\n- ${criterion.name}: ${criterion.description} (Max score: ${criterion.maxScore})`;
      }
    }
    
    return systemPrompt;
  }
}