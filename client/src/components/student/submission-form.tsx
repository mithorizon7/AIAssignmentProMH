import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/ui/file-upload";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Assignment, Submission } from "@/lib/types";
import { formatDate, formatTimeRemaining } from "@/lib/utils/format";
import { apiRequest } from "@/lib/queryClient";
import { API_ROUTES } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Clock, RefreshCw, Loader2, Upload, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { QuillContent } from "@/components/quill-content";

interface SubmissionFormProps {
  assignment: Assignment;
  onSubmissionComplete?: (submission: Submission) => void;
}

export function SubmissionForm({ assignment, onSubmissionComplete }: SubmissionFormProps) {
  const [submissionType, setSubmissionType] = useState<'file' | 'text'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [code, setCode] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "processing" | "complete" | "error">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append('assignmentId', assignment.id.toString());
      formData.append('submissionType', submissionType);
      
      if (submissionType === 'file' && file) {
        formData.append('file', file);
      } else if (submissionType === 'text') {
        formData.append('content', code);
      }
      
      if (notes) {
        formData.append('notes', notes);
      }
      
      // Set status to uploading before making the request
      setUploadStatus("uploading");
      
      // Create a progress tracker
      let uploadComplete = false;
      const progressInterval = setInterval(() => {
        if (!uploadComplete) {
          setUploadProgress(prev => {
            // Simulate progress that slows down as it approaches 90%
            // Real implementation would use fetch with XMLHttpRequest for actual progress
            const increment = Math.max(1, Math.floor((100 - prev) / 10));
            const newProgress = Math.min(90, prev + increment);
            return newProgress;
          });
        }
      }, 300);
      
      try {
        const response = await fetch(`${API_ROUTES.SUBMISSIONS}`, {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });
        
        // Upload is complete
        uploadComplete = true;
        clearInterval(progressInterval);
        setUploadProgress(100);
        
        if (!response.ok) {
          const errorData = await response.json();
          setUploadStatus("error");
          throw new Error(errorData.message || 'Failed to submit assignment');
        }
        
        // Set status to processing while waiting for AI analysis
        setUploadStatus("processing");
        
        const data = await response.json();
        
        // On successful response, set status to complete
        setUploadStatus("complete");
        
        return data;
      } catch (error) {
        uploadComplete = true;
        clearInterval(progressInterval);
        setUploadStatus("error");
        throw error;
      }
    },
    onSuccess: (data) => {
      toast({
        title: 'Assignment Submitted Successfully',
        description: 'Your assignment has been received. AI feedback will be available shortly.',
        variant: 'default',
        duration: 5000,
        action: (
          <Button variant="outline" size="sm" onClick={() => {
            if (onSubmissionComplete) {
              onSubmissionComplete(data);
            }
          }}>
            <CheckCircle className="h-4 w-4 mr-1" />
            View
          </Button>
        ),
      });
      
      queryClient.invalidateQueries({ queryKey: [API_ROUTES.SUBMISSIONS] });
      queryClient.invalidateQueries({ queryKey: [API_ROUTES.ASSIGNMENTS] });
      
      if (onSubmissionComplete) {
        onSubmissionComplete(data);
      }
      
      // Reset to idle state after a delay to allow seeing the complete status
      setTimeout(() => {
        // Clear form
        setFile(null);
        setCode('');
        setNotes('');
        setUploadStatus("idle");
        setUploadProgress(0);
      }, 2000);
    },
    onError: (error) => {
      // Error status is already set in the mutation function
      
      toast({
        variant: 'destructive',
        title: 'Submission Error',
        description: error instanceof Error 
          ? error.message 
          : 'There was a problem submitting your assignment. Please try again.',
        duration: 7000,
        action: (
          <Button variant="outline" size="sm" onClick={() => {
            setUploadStatus("idle");
            setUploadProgress(0);
            handleSubmit();
          }}>
            Try Again
          </Button>
        ),
      });
    }
  });
  
  const handleSubmit = () => {
    if (submissionType === 'file' && !file) {
      toast({
        variant: 'destructive',
        title: 'File Required',
        description: 'Please upload a file to submit your assignment.',
        action: (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => document.querySelector('.file-upload-area')?.scrollIntoView({behavior: 'smooth'})}
          >
            <AlertCircle className="h-4 w-4 mr-1" />
            Show
          </Button>
        ),
      });
      return;
    }
    
    if (submissionType === 'text' && !code.trim()) {
      toast({
        variant: 'destructive',
        title: 'Content Required',
        description: 'Please enter your submission content before submitting your assignment.',
        action: (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              const element = document.querySelector('[data-value="text"]') as HTMLElement;
              if (element) element.click();
            }}
          >
            <AlertCircle className="h-4 w-4 mr-1" />
            Switch to Content Tab
          </Button>
        ),
      });
      return;
    }
    
    mutate();
  };
  
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-neutral-200">
        <CardTitle className="text-xl">{assignment.title}</CardTitle>
        <div className="text-muted-foreground">
          <QuillContent content={assignment.description} />
        </div>
        
        <div className="flex flex-wrap gap-4 text-sm mt-4">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-neutral-50 rounded-md">
            <Calendar className="h-4 w-4 text-neutral-500" />
            <span>Due: {formatDate(assignment.dueDate)}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 bg-neutral-50 rounded-md">
            <Clock className="h-4 w-4 text-neutral-500" />
            <span>Time remaining: {formatTimeRemaining(assignment.dueDate)}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 bg-neutral-50 rounded-md">
            <RefreshCw className="h-4 w-4 text-neutral-500" />
            <span>Submissions allowed: Unlimited until due date</span>
          </div>
        </div>
        
        {/* Display assignment rubric */}
        {assignment.rubric && assignment.rubric.criteria && assignment.rubric.criteria.length > 0 && (
          <div className="mt-6 p-4 bg-white border border-neutral-200 rounded-md">
            <h3 className="text-md font-medium mb-2">Grading Rubric</h3>
            <div className="space-y-3">
              {assignment.rubric.criteria.map((criterion, index) => (
                <div key={criterion.id || index} className="p-3 bg-neutral-50 rounded-md">
                  <div className="flex justify-between">
                    <h4 className="font-medium text-sm">{criterion.name}</h4>
                    <span className="text-sm text-neutral-600">Max: {criterion.maxScore} points</span>
                  </div>
                  <p className="text-sm text-neutral-700 mt-1">{criterion.description}</p>
                </div>
              ))}
              {assignment.rubric.passingThreshold && (
                <div className="text-sm text-neutral-600 mt-1">
                  Passing threshold: {assignment.rubric.passingThreshold}%
                </div>
              )}
            </div>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="p-6">
        <div className="mb-6">
          <h3 className="text-lg font-medium text-neutral-800 mb-2">Submit Your Work</h3>
          <p className="text-neutral-600 text-sm mb-4">
            You can upload a file or enter your submission directly. You'll receive AI feedback within 60 seconds after submission.
          </p>
          
          <Tabs defaultValue="file" onValueChange={(value) => setSubmissionType(value as 'file' | 'text')}>
            <TabsList className="mb-6 border-b border-neutral-200">
              <TabsTrigger value="file">Upload File</TabsTrigger>
              <TabsTrigger value="text">Enter Content</TabsTrigger>
            </TabsList>
            
            <TabsContent value="file" className="file-upload-area">
              <FileUpload 
                onValueChange={(files) => setFile(files.length > 0 ? files[0] : null)}
                accept=".py,.java,.cpp,.ipynb,.zip,.js,.ts,.html,.css,.md,.txt,.pdf,.jpg,.jpeg,.png,.csv,.mp4,.mp3,.doc,.docx"
                maxSize={10 * 1024 * 1024}
                maxFiles={1}
                processingStatus={isPending ? uploadStatus : "idle"}
                processingProgress={uploadProgress}
                showPreviews={true}
                disabled={isPending}
                className="transition-all duration-300"
              />
              
              {/* Additional multimodal info */}
              <div className="mt-4 text-sm text-neutral-600 bg-blue-50 border border-blue-100 rounded-md p-3 slide-in-right" style={{animationDelay: "100ms"}}>
                <h4 className="font-medium text-blue-800 mb-1">Multimodal File Support</h4>
                <p className="mb-2">This assignment supports a wide range of file types with Gemini's advanced multimodal analysis capabilities:</p>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <li className="flex items-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mr-1"></span>
                    Images: JPG, PNG, GIF
                  </li>
                  <li className="flex items-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mr-1"></span>
                    Code: Python, Java, JavaScript
                  </li>
                  <li className="flex items-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mr-1"></span>
                    Documents: PDF, Word, Text
                  </li>
                  <li className="flex items-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mr-1"></span>
                    Data: CSV, Excel, JSON
                  </li>
                  <li className="flex items-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mr-1"></span>
                    Audio/Video: MP3, MP4
                  </li>
                  <li className="flex items-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mr-1"></span>
                    Archives: ZIP (multiple files)
                  </li>
                </ul>
              </div>
            </TabsContent>
            
            <TabsContent value="text">
              <RichTextEditor 
                value={code} 
                onChange={setCode} 
                placeholder="Enter your assignment content here..."
                className="min-h-[250px]"
              />
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
      
      <CardFooter className="flex flex-col border-t border-neutral-200 p-4">
        {/* Add notes section at the bottom */}
        <div className="w-full mb-6">
          <label htmlFor="notes" className="block text-sm font-medium text-neutral-700 mb-1">
            Submission Notes (optional)
          </label>
          <RichTextEditor
            value={notes}
            onChange={setNotes}
            placeholder="Add any notes for your instructor..."
          />
        </div>
        
        <div className="flex justify-end w-full">
          <Button 
            onClick={handleSubmit} 
            disabled={isPending} 
            className={cn(
              "px-4 py-2 min-w-[180px] relative overflow-hidden group btn-hover-effect transition-all duration-300",
              uploadStatus === "processing" && "bg-amber-600 hover:bg-amber-700",
              uploadStatus === "complete" && "bg-green-600 hover:bg-green-700"
            )}
          >
            {isPending ? (
              <>
                {uploadStatus === "uploading" && (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading... {uploadProgress}%
                  </>
                )}
                {uploadStatus === "processing" && (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing with AI...
                  </>
                )}
                {uploadStatus === "complete" && (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Submission Complete
                  </>
                )}
                {uploadStatus === "error" && (
                  <>
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Submission Failed
                  </>
                )}
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2 group-hover:translate-y-[-2px] transition-transform duration-300" />
                Submit Assignment
              </>
            )}
            
            {/* Animated slide-in background on hover */}
            <span className="absolute inset-0 bg-gradient-to-r from-primary-600 to-primary-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
