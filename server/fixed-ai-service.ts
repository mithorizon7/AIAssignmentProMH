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
   * Analyzes a multimodal student submission (images, PDFs, etc.) with enhanced assignment context
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
      if (!processedFile || !this.adapter.supportsContentType(processedFile.contentType)) {
        console.log(`[AIService] Multimodal processing not supported for content type ${processedFile?.contentType}, falling back to text analysis`);
        
        // Fall back to text-only analysis
        let textContent = '';
        
        if (processedFile.textContent) {
          textContent = processedFile.textContent;
          console.log('[AIService] Using extracted text content for fallback analysis');
        } else if (typeof processedFile.content === 'string') {
          textContent = processedFile.content;
          console.log('[AIService] Using raw string content for fallback analysis');
        } else {
          textContent = `[This submission contains ${processedFile.contentType} content that could not be automatically processed as text]`;
          console.log('[AIService] No text content available, using placeholder');
        }
        
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
      let systemPrompt = "You are an expert AI Teaching Assistant analyzing a " + processedFile.contentType + " submission for a specific assignment.\n";
      systemPrompt += "Your primary task is to evaluate how well this submission meets the assignment requirements and criteria.\n\n";
      systemPrompt += "## ASSIGNMENT REQUIREMENTS:\n";
      systemPrompt += "Assignment: " + params.assignmentTitle + "\n\n";

      // Add description with emphasis on assignment requirements
      if (params.assignmentDescription) {
        systemPrompt += "## ASSIGNMENT DESCRIPTION:\n";
        systemPrompt += params.assignmentDescription + "\n\n";
        systemPrompt += "IMPORTANT: The submission MUST be evaluated primarily on how well it fulfills the specific requirements in this assignment description. ";
        systemPrompt += "Submissions that do not address the assignment topic or requirements should receive critical feedback highlighting this mismatch.\n\n";
      }
      
      // Add specific analysis guidance for the content type
      systemPrompt += "## HOW TO ANALYZE THIS " + processedFile.contentType.toUpperCase() + " SUBMISSION:\n";
      
      if (processedFile.contentType === 'image') {
        systemPrompt += "1. First determine if the image content matches the assignment requirements above\n";
        systemPrompt += "2. Analyze visual elements, composition, technical execution, and conceptual aspects that relate to the assignment\n";
        systemPrompt += "3. Pay attention to details such as color, composition, technical execution, and creative choices that support the assignment goals\n";
        systemPrompt += "4. Provide specific feedback that references exact visual elements and how they fulfill assignment requirements\n";
        systemPrompt += "5. Evaluate both technical skills and creative/conceptual understanding in relation to the assignment\n\n";
      } else if (processedFile.contentType === 'document') {
        systemPrompt += "1. First determine if the document content addresses the assignment topic and requirements\n"; 
        systemPrompt += "2. Analyze the document structure, content organization, clarity, and coherence as they relate to assignment goals\n";
        systemPrompt += "3. Evaluate accuracy, thoroughness, and relevance of information to the assignment requirements\n";
        systemPrompt += "4. Provide specific feedback on writing style, argumentation, and evidence use that supports assignment objectives\n";
        systemPrompt += "5. Look for proper citation and reference use when applicable\n\n";
      } else {
        systemPrompt += "1. First determine if the submission content addresses the assignment topic and requirements\n";
        systemPrompt += "2. Carefully examine both technical correctness and creative aspects in relation to assignment goals\n";
        systemPrompt += "3. Consider organization, structure, and presentation quality as they relate to assignment requirements\n";
        systemPrompt += "4. Provide specific feedback referencing exact elements from the submission and how they fulfill assignment criteria\n";
        systemPrompt += "5. Evaluate the submission holistically against all assignment requirements\n\n";
      }

      systemPrompt += "Respond with a structured assessment that includes:\n";
      systemPrompt += "1. An evaluation of how well the submission meets the specific assignment requirements\n";
      systemPrompt += "2. Specific strengths related to the assignment criteria\n";
      systemPrompt += "3. Areas for improvement directly tied to assignment requirements\n";
      systemPrompt += "4. Targeted suggestions that would help better fulfill the assignment objectives\n";
      
      // Add instructor context if provided (secret information not shown to students)
      if (params.instructorContext && params.instructorContext.content) {
        const contextContent = params.instructorContext.content;
        
        systemPrompt += "\n## INSTRUCTOR-ONLY EVALUATION GUIDANCE (DO NOT REVEAL TO STUDENTS):\n";
        systemPrompt += contextContent + "\n\n";
        systemPrompt += "IMPORTANT: The above section contains specific guidance provided by the instructor to help in your evaluation. ";
        systemPrompt += "Use these points to inform your analysis and the feedback you provide, but DO NOT directly quote or reveal ";
        systemPrompt += "this instructor-provided information in your feedback to the student. Instead, incorporate these insights ";
        systemPrompt += "into your evaluation logic while keeping the actual guidance confidential.\n";
      }
      
      // Add rubric criteria if available
      if (params.rubric && params.rubric.criteria && params.rubric.criteria.length > 0) {
        systemPrompt += "\nRubric criteria to assess:\n";
        for (const criterion of params.rubric.criteria) {
          systemPrompt += "- " + criterion.name + ": " + criterion.description + " (Max score: " + criterion.maxScore + ")\n";
        }
      }
      
      console.log("[AIService] Sending multimodal request to AI adapter with content type: " + processedFile.contentType);
      
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

  /**
   * Prepare AI feedback for storage in the database
   */
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