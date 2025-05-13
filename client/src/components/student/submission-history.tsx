import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FeedbackCard } from "@/components/ui/feedback-card";
import { formatDate } from "@/lib/utils/format";
import { SubmissionWithFeedback } from "@/lib/types";
import { useState } from "react";
import { 
  History, Loader2, ArrowUpCircle, FileText, File, 
  Image, FileCode, Video, Music, PieChart, FileJson, 
  CheckCircle, AlertCircle 
} from "lucide-react";
import { useLocation } from "wouter";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Helper function to get appropriate file icon based on file type
function getSubmissionFileIcon(fileType: string, fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  
  if (fileType.startsWith('image/')) {
    return <Image size={18} className="text-blue-600 mr-2" />;
  } else if (fileType.startsWith('video/')) {
    return <Video size={18} className="text-purple-600 mr-2" />;
  } else if (fileType.startsWith('audio/')) {
    return <Music size={18} className="text-amber-600 mr-2" />;
  } else if (fileType.startsWith('text/')) {
    return <FileText size={18} className="text-gray-600 mr-2" />;
  } else if (['application/pdf'].includes(fileType)) {
    return <FileText size={18} className="text-red-600 mr-2" />;
  } else if (['application/json'].includes(fileType) || extension === 'json') {
    return <FileJson size={18} className="text-green-600 mr-2" />;
  } else if ([
    'application/javascript', 
    'application/typescript',
    'application/x-python',
    'text/x-python',
    'application/x-java',
    'text/x-java'
  ].includes(fileType) || ['js', 'ts', 'py', 'java', 'c', 'cpp', 'html', 'css'].includes(extension)) {
    return <FileCode size={18} className="text-indigo-600 mr-2" />;
  } else if (['csv', 'xls', 'xlsx', 'numbers'].includes(extension)) {
    return <PieChart size={18} className="text-emerald-600 mr-2" />;
  }
  
  return <File size={18} className="text-neutral-600 mr-2" />;
}

// Helper to format file size
function formatSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

interface SubmissionHistoryProps {
  submissions: SubmissionWithFeedback[];
  loading?: boolean;
}

export function SubmissionHistory({ submissions, loading = false }: SubmissionHistoryProps) {
  const [expandedFeedbacks, setExpandedFeedbacks] = useState<Record<number, boolean>>({});
  const [, navigate] = useLocation();
  
  const toggleFeedback = (submissionId: number) => {
    setExpandedFeedbacks(prev => ({
      ...prev,
      [submissionId]: !prev[submissionId]
    }));
  };
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Submission History</CardTitle>
          <CardDescription>Loading your previous submissions...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center p-10">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
        </CardContent>
      </Card>
    );
  }
  
  if (submissions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Submission History</CardTitle>
          <CardDescription>View your previous submissions and AI feedback</CardDescription>
        </CardHeader>
        <CardContent className="p-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 mb-4">
            <History className="h-6 w-6 text-neutral-500" />
          </div>
          <h3 className="text-lg font-medium text-neutral-700 mb-2">No submission history</h3>
          <p className="text-neutral-600 mb-4">When you submit assignments, they'll appear here with detailed AI feedback.</p>
          <Button 
            variant="outline" 
            onClick={() => navigate('/assignments')}
            className="inline-flex items-center justify-center"
          >
            <ArrowUpCircle className="mr-2 h-4 w-4" />
            Find assignments to submit
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Submission History</CardTitle>
        <CardDescription>View your previous submissions and AI feedback</CardDescription>
      </CardHeader>
      
      <CardContent className="p-6">
        {submissions.map((submission, index) => (
          <div 
            key={submission.id}
            className={`border-l-2 ${
              index === 0 ? 'border-primary' : 'border-neutral-300'
            } pl-4 pb-8 relative`}
          >
            <div 
              className={`absolute w-3 h-3 ${
                index === 0 ? 'bg-primary' : 'bg-neutral-300'
              } rounded-full -left-[7px]`}
            ></div>
            
            <div className="mb-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-neutral-800">Submission #{submissions.length - index}</h3>
                  <p className="text-sm text-neutral-600">{formatDate(submission.createdAt)}</p>
                </div>
                {index === 0 && (
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                    Latest
                  </span>
                )}
                {index > 0 && (
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-neutral-100 text-neutral-800">
                    Previous
                  </span>
                )}
              </div>
            </div>
            
            {/* Feedback Card */}
            {submission.feedback ? (
              <FeedbackCard 
                feedback={submission.feedback} 
                expanded={!!expandedFeedbacks[submission.id]}
                onToggle={() => toggleFeedback(submission.id)}
              />
            ) : (
              submission.status === 'processing' ? (
                <div className="bg-blue-50 rounded-lg p-4 mb-4 fade-in" style={{animationDelay: "200ms"}}>
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium text-neutral-800">AI Feedback</h4>
                    <span className="text-xs text-blue-600 flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Processing...
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600 mt-2">Your feedback is being generated and will appear here shortly.</p>
                  
                  {/* Processing visualization */}
                  <div className="mt-3 flex items-center gap-2 text-xs text-blue-800">
                    <div className="flex-1 bg-blue-100 h-1.5 rounded-full overflow-hidden relative">
                      <div className="absolute inset-0 flex items-center gap-1">
                        <div className="h-2 w-2 rounded-full bg-blue-500 animate-bounce" style={{animationDelay: "0ms"}}></div>
                        <div className="h-2 w-2 rounded-full bg-blue-500 animate-bounce" style={{animationDelay: "300ms"}}></div>
                        <div className="h-2 w-2 rounded-full bg-blue-500 animate-bounce" style={{animationDelay: "600ms"}}></div>
                      </div>
                    </div>
                    <span className="whitespace-nowrap">Analyzing submission...</span>
                  </div>
                  
                  <div className="mt-3 text-xs p-2 bg-blue-100 rounded border border-blue-200">
                    <p className="text-blue-700 font-medium mb-1">Multimodal Analysis Progress:</p>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="px-1.5 py-0.5 bg-blue-200 text-blue-800 rounded flex items-center">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Extract content
                      </span>
                      <span className="px-1.5 py-0.5 bg-blue-200 text-blue-800 rounded flex items-center">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Parse structure
                      </span>
                      <span className="px-1.5 py-0.5 bg-white/80 text-blue-800 rounded flex items-center">
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Evaluating criteria
                      </span>
                      <span className="px-1.5 py-0.5 bg-white/50 text-blue-500 rounded flex items-center opacity-70">
                        Generate feedback
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 rounded-lg p-4 mb-4 fade-in" style={{animationDelay: "200ms"}}>
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium text-neutral-800">AI Feedback</h4>
                    <span className="text-xs text-amber-600 px-2 py-1 rounded-full bg-amber-100 flex items-center">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Feedback unavailable
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600 mt-2">There was an issue generating feedback for this submission.</p>
                  
                  <div className="mt-3 p-2 bg-amber-100 rounded border border-amber-200">
                    <p className="text-amber-700 text-xs">Our AI system encountered difficulty processing this specific file type or content. Please try submitting in a different format.</p>
                    <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={() => navigate('/assignments')}>
                      Submit again
                    </Button>
                  </div>
                </div>
              )
            )}
            
            {/* Submission File/Content Link with Preview */}
            <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden scale-in" style={{animationDelay: `${index * 50}ms`}}>
              {/* File Preview Section for Images */}
              {submission.fileName && submission.fileType && submission.fileType.startsWith('image/') && submission.fileUrl && (
                <div className="border-b relative overflow-hidden bg-neutral-50 h-40 flex items-center justify-center">
                  <img 
                    src={submission.fileUrl} 
                    alt={submission.fileName}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              )}
              
              {/* File Preview For Code */}
              {!submission.fileName && submission.code && (
                <div className="border-b relative overflow-hidden bg-gray-800 text-gray-100 text-xs p-3 max-h-32 overflow-y-auto">
                  <pre className="font-mono">
                    {submission.code.length > 300 
                      ? submission.code.substring(0, 300) + '...' 
                      : submission.code}
                  </pre>
                </div>
              )}
              
              {/* Processing Status for Pending Submissions */}
              {submission.status === 'processing' && (
                <div className="bg-blue-50 px-3 py-2 border-b border-blue-100">
                  <div className="flex items-center text-xs text-blue-800">
                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                    <span>AI is analyzing your submission...</span>
                  </div>
                  <div className="mt-1.5">
                    <div className="w-full bg-blue-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-blue-500 h-full rounded-full shimmer" style={{width: '60%'}}></div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* File Info and Download/View Button */}
              <div className="p-3 flex justify-between items-center">
                <div className="flex items-center">
                  {submission.fileName && submission.fileType ? (
                    getSubmissionFileIcon(submission.fileType, submission.fileName)
                  ) : submission.submissionType === 'code' ? (
                    <FileCode className="h-5 w-5 text-indigo-600 mr-2" />
                  ) : (
                    <FileText className="h-5 w-5 text-neutral-600 mr-2" />
                  )}
                  <div>
                    <span className="text-sm text-neutral-700 font-medium">
                      {submission.fileName || 'Code submission'}
                    </span>
                    {submission.fileSize && (
                      <p className="text-xs text-neutral-500">
                        {formatSize(submission.fileSize)}
                      </p>
                    )}
                  </div>
                </div>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-primary hover:text-primary-dark hover:bg-primary-50 transition-colors btn-hover-effect"
                        onClick={() => {
                          // In a real implementation, this would download or view the submission
                          // For now, we'll just show the action with a toast
                          window.alert(`${submission.fileName ? 'Downloading' : 'Viewing'} submission: ${submission.fileName || 'Code content'}`);
                        }}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        {submission.fileName ? 'Download' : 'View'}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{submission.fileName ? `Download ${submission.fileName}` : 'View full code'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
