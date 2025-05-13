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
import { CodeEditor } from "@/components/ui/code-editor";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Assignment, Submission } from "@/lib/types";
import { formatDate, formatTimeRemaining } from "@/lib/utils/format";
import { apiRequest } from "@/lib/queryClient";
import { API_ROUTES } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Clock, RefreshCw, Loader2, Upload, AlertCircle, CheckCircle } from "lucide-react";

interface SubmissionFormProps {
  assignment: Assignment;
  onSubmissionComplete?: (submission: Submission) => void;
}

export function SubmissionForm({ assignment, onSubmissionComplete }: SubmissionFormProps) {
  const [submissionType, setSubmissionType] = useState<'file' | 'code'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [code, setCode] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append('assignmentId', assignment.id.toString());
      formData.append('submissionType', submissionType);
      
      if (submissionType === 'file' && file) {
        formData.append('file', file);
      } else if (submissionType === 'code') {
        formData.append('code', code);
      }
      
      if (notes) {
        formData.append('notes', notes);
      }
      
      const response = await fetch(`${API_ROUTES.SUBMISSIONS}`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit assignment');
      }
      
      return await response.json();
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
      
      // Clear form
      setFile(null);
      setCode('');
      setNotes('');
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Submission Error',
        description: error instanceof Error 
          ? error.message 
          : 'There was a problem submitting your assignment. Please try again.',
        duration: 7000,
        action: (
          <Button variant="outline" size="sm" onClick={() => handleSubmit()}>
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
    
    if (submissionType === 'code' && !code.trim()) {
      toast({
        variant: 'destructive',
        title: 'Code Required',
        description: 'Please enter your code before submitting your assignment.',
        action: (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              const element = document.querySelector('[data-value="code"]') as HTMLElement;
              if (element) element.click();
            }}
          >
            <AlertCircle className="h-4 w-4 mr-1" />
            Switch to Code Tab
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
        <CardDescription>{assignment.description}</CardDescription>
        
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
      </CardHeader>
      
      <CardContent className="p-6">
        <div className="mb-6">
          <h3 className="text-lg font-medium text-neutral-800 mb-2">Submit Your Assignment</h3>
          <p className="text-neutral-600 text-sm mb-4">
            You can upload a file or paste your code directly. You'll receive AI feedback within 60 seconds after submission.
          </p>
          
          <Tabs defaultValue="file" onValueChange={(value) => setSubmissionType(value as 'file' | 'code')}>
            <TabsList className="mb-6 border-b border-neutral-200">
              <TabsTrigger value="file">Upload File</TabsTrigger>
              <TabsTrigger value="code">Paste Code</TabsTrigger>
            </TabsList>
            
            <TabsContent value="file" className="file-upload-area">
              <FileUpload 
                onValueChange={(files) => setFile(files.length > 0 ? files[0] : null)}
                accept=".py,.java,.cpp,.ipynb,.zip,.js,.ts,.html,.css,.md,.txt"
                maxSize={10 * 1024 * 1024}
                maxFiles={1}
              />
            </TabsContent>
            
            <TabsContent value="code">
              <CodeEditor 
                value={code} 
                onChange={setCode} 
                placeholder="// Paste your code here..." 
                height="250px"
              />
            </TabsContent>
          </Tabs>
        </div>
        
        <div className="mb-6">
          <label htmlFor="notes" className="block text-sm font-medium text-neutral-700 mb-1">
            Submission Notes (optional)
          </label>
          <RichTextEditor
            value={notes}
            onChange={setNotes}
            placeholder="Add any notes for your instructor..."
          />
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-end border-t border-neutral-200 p-4">
        <Button 
          onClick={handleSubmit} 
          disabled={isPending} 
          className="px-4 py-2 min-w-[160px]"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Submit Assignment
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
