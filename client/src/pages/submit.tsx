import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { API_ROUTES, APP_ROUTES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/ui/file-upload";
import { QuillEditor } from "@/components/quill-editor";
import { QuillContent } from "@/components/quill-content";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SubmitAssignmentProps {
  code?: string;
}

export default function SubmitAssignment({ code: propCode }: SubmitAssignmentProps) {
  const [match, params] = useRoute('/submit/:code');
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  
  // Use the code from props or from the route params
  const assignmentCode = propCode || params?.code;

  // State for assignment lookup
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<{
    id: number;
    title: string;
    description: string;
    courseName?: string;
    courseCode?: string;
    dueDate: string;
    shareableCode: string;
  } | null>(null);
  
  // State for submission
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [codeContent, setCodeContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitType, setSubmitType] = useState<'code' | 'file'>('code');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      // Encode current URL to redirect back after login
      const returnUrl = encodeURIComponent(`/submit/${assignmentCode}`);
      navigate(`/login?returnTo=${returnUrl}`);
    }
  }, [isAuthenticated, assignmentCode, navigate]);

  // Fetch assignment data using the code
  useEffect(() => {
    if (!match || !assignmentCode) return;
    // Skip fetching if not authenticated
    if (!isAuthenticated) return;
    
    const fetchAssignment = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`${API_ROUTES.ASSIGNMENTS}/code/${assignmentCode}`, {
          credentials: 'include',
        });
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Assignment not found. The link may be incorrect or expired.');
          }
          throw new Error('Failed to load assignment details.');
        }
        
        const data = await response.json();
        
        // Verify the assignment has a shareable code
        if (!data.shareableCode) {
          throw new Error('Invalid assignment link. This assignment may not be configured for anonymous submissions.');
        }
        
        setAssignment(data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred while loading the assignment.';
        setError(errorMessage);
        console.error('Error fetching assignment by code:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAssignment();
  }, [match, assignmentCode, isAuthenticated]);
  
  // Pre-fill form if user is authenticated
  useEffect(() => {
    if (user && isAuthenticated) {
      setName(user.name || '');
      setEmail(user.email || '');
    }
  }, [user, isAuthenticated]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!assignment) return;
    
    try {
      setSubmitting(true);
      
      // Form validation (only for anonymous users)
      if (!isAuthenticated) {
        if (!name.trim()) {
          toast({
            title: "Missing Information",
            description: "Please enter your name.",
            variant: "destructive",
          });
          return;
        }
        
        if (!email.trim() || !email.includes('@')) {
          toast({
            title: "Invalid Email",
            description: "Please enter a valid email address.",
            variant: "destructive",
          });
          return;
        }
      }
      
      if (submitType === 'code' && !codeContent.trim()) {
        toast({
          title: "Missing Code",
          description: "Please enter your code.",
          variant: "destructive",
        });
        return;
      }
      
      if (submitType === 'file' && !file) {
        toast({
          title: "Missing File",
          description: "Please upload a file.",
          variant: "destructive",
        });
        return;
      }
      
      // Prepare form data
      const formData = new FormData();
      formData.append('assignmentId', assignment.id.toString());
      formData.append('submissionType', submitType);
      
      // For anonymous submissions, include name and email
      if (!isAuthenticated) {
        formData.append('name', name);
        formData.append('email', email);
        // Critical security parameter - include the shareable code for validation
        formData.append('shareableCode', assignment.shareableCode);
      }
      
      // Get CSRF token first
      const csrfResponse = await fetch('/api/csrf-token', {
        credentials: 'include',
      });
      
      if (!csrfResponse.ok) {
        throw new Error('Failed to get security token');
      }
      
      const { csrfToken } = await csrfResponse.json();
      console.log(`[SUBMIT] Got CSRF token: ${csrfToken?.substring(0, 10)}...`);
      
      // Add CSRF token to form data as fallback
      formData.append('csrfToken', csrfToken);
      
      if (notes) formData.append('notes', notes);
      if (submitType === 'code') formData.append('code', codeContent);
      if (submitType === 'file' && file) formData.append('file', file);
      
      // Determine which endpoint to use based on authentication status
      const submissionEndpoint = isAuthenticated ? '/api/submissions' : '/api/anonymous-submissions';
      console.log(`[SUBMIT] Using endpoint: ${submissionEndpoint}`);
      console.log(`[SUBMIT] Authentication status: ${isAuthenticated}`);
      
      // Send submission with CSRF token in both header and body
      const response = await fetch(submissionEndpoint, {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrfToken,
        },
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        // Handle different error types with appropriate messages
        if (response.status === 403) {
          throw new Error('Access denied. The submission link may have expired or is invalid.');
        } else if (response.status === 404) {
          throw new Error('Assignment not found. Please check the link and try again.');
        } else if (response.status === 400) {
          const errorData = await response.json();
          throw new Error(`Submission failed: ${errorData.message || response.statusText}`);
        } else {
          throw new Error(`Submission failed: ${response.statusText}`);
        }
      }
      
      // Show success message
      toast({
        title: "Submission Successful",
        description: "Your work has been submitted for review!",
      });
      
      setSubmitted(true);
    } catch (error) {
      console.error('Error submitting assignment:', error);
      toast({
        title: "Submission Failed",
        description: error instanceof Error 
          ? error.message 
          : "There was a problem submitting your work. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading assignment details...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background">
        <Card className="w-full max-w-lg shadow-lg">
          <CardHeader className="bg-destructive/10">
            <CardTitle className="text-destructive">Assignment Not Found</CardTitle>
            <CardDescription className="text-destructive/80">
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-center mb-4">
              <p className="mb-6">
                Please check the link and try again, or contact your instructor.
              </p>
              <Button onClick={() => navigate('/')} aria-label="Return to homepage">Go to Homepage</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (submitted && assignment) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background">
        <Card className="w-full max-w-lg shadow-lg">
          <CardHeader className="bg-green-50 dark:bg-green-950">
            <CardTitle className="text-green-600 dark:text-green-400">Submission Successful!</CardTitle>
            <CardDescription>
              Your work has been submitted successfully
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-center mb-4">
              <p className="mb-6">
                Thank you for submitting your work to <strong>{assignment.title}</strong>. 
                Your submission has been received and will be processed by our AI system for feedback.
              </p>
              {/* All submissions now require authentication */}
              <div className="flex justify-center space-x-4">
                <Button variant="outline" onClick={() => setSubmitted(false)}>
                  Submit Another
                </Button>
                <Button onClick={() => navigate(isAuthenticated ? '/dashboard' : '/login')}>
                  {isAuthenticated ? 'Go to Dashboard' : 'Sign In'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Return null if no assignment data
  if (!assignment) {
    return null;
  }
  
  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container px-4 mx-auto max-w-4xl">
        <Card className="shadow-lg">
          <CardHeader className="bg-primary/5">
            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
              <div>
                <CardTitle className="text-xl">{assignment.title}</CardTitle>
                <CardDescription>
                  {assignment.courseName && assignment.courseCode 
                    ? `${assignment.courseName} (${assignment.courseCode})`
                    : 'Assignment'
                  }
                </CardDescription>
              </div>
              <div className="text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <span className="material-icons-outlined text-sm">event</span>
                  <span>Due: {new Date(assignment.dueDate).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            
            {/* Authentication notification banner */}
            {isAuthenticated ? (
              <div className="mt-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded p-3 text-sm text-green-800 dark:text-green-200 flex items-start gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0 text-green-500 dark:text-green-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>
                  <strong>Authenticated Submission:</strong> Submitting as {user?.name || user?.username} - your submission will be automatically linked to your account.
                </span>
              </div>
            ) : (
              <div className="mt-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded p-3 text-sm text-blue-800 dark:text-blue-200 flex items-start gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0 text-blue-500 dark:text-blue-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span>
                  <strong>Anonymous Submission:</strong> Please provide your name and email for this submission.
                </span>
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-6">
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-2">Assignment Description</h3>
              <QuillContent 
                content={assignment.description || ''} 
                className="text-muted-foreground text-sm" 
              />
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Only show name and email fields for anonymous users */}
              {!isAuthenticated && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Your Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      disabled={submitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={submitting}
                    />
                  </div>
                </div>
              )}
              
              {/* Primary Submission Section with Enhanced Visual Hierarchy */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg p-6 border-2 border-blue-200 dark:border-blue-800 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">Submit Your Work</h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300">Choose your preferred submission method below</p>
                  </div>
                </div>
                
                <Tabs value={submitType} onValueChange={(value) => setSubmitType(value as 'code' | 'file')} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <TabsTrigger 
                      value="code" 
                      className="flex items-center gap-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                      Paste Text/Code
                    </TabsTrigger>
                    <TabsTrigger 
                      value="file"
                      className="flex items-center gap-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      File Upload
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="code" className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="code" className="text-base font-medium text-gray-900 dark:text-gray-100">
                          Your Content
                        </Label>
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">Required</span>
                      </div>
                      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-1 hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                        <Textarea
                          placeholder="Paste your text, essay, or code here..."
                          className="min-h-[200px] border-none focus:ring-0 resize-none"
                          value={codeContent}
                          onChange={(e) => setCodeContent(e.target.value)}
                          disabled={submitting}
                        />
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="file" className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="file" className="text-base font-medium text-gray-900 dark:text-gray-100">
                          Choose File
                        </Label>
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">Required</span>
                      </div>
                      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                        <FileUpload
                          onValueChange={(files: File[]) => setFile(files[0] || null)}
                          disabled={submitting}
                          accept=".py,.java,.cpp,.ipynb,.zip,.js,.ts,.html,.css,.md,.txt,.pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.svg,.bmp,.tiff,.mp3,.wav,.mp4,.mov,.avi,.json,.xml,.csv,.xlsx"
                          maxSize={50 * 1024 * 1024} // 50MB for multimedia files
                        />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
              
              {/* Notes Section - Positioned After Main Submission */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="notes" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Additional Notes
                    </Label>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">Optional</span>
                  </div>
                  <QuillEditor
                    value={notes}
                    onChange={setNotes}
                    placeholder="Add any notes or comments about your submission..."
                    disabled={submitting}
                  />
                </div>
              </div>
              
              {/* Enhanced Submit Button */}
              <div className="flex justify-center pt-6">
                <Button 
                  type="submit" 
                  disabled={submitting}
                  className="px-8 py-3 text-lg font-medium bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {submitting ? (
                    <div className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Submitting...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Submit Assignment
                    </div>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}