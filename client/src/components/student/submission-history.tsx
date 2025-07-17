import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FeedbackCard } from "@/components/ui/feedback-card";
import { RealTimeSubmissionCard } from "./real-time-submission-card";
import { formatDate } from "@/lib/utils/format";
import { SubmissionWithFeedback } from "@/lib/types";
import { useState, useCallback } from "react";
import * as React from "react";
import { 
  History, Loader2, ArrowUpCircle, FileText, File, 
  Image, FileCode, Video, Music, PieChart, FileJson, 
  CheckCircle, AlertCircle, Bell, Sparkles 
} from "lucide-react";
import { useLocation } from "wouter";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSubmissionPolling } from "@/hooks/useSubmissionPolling";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

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
  showAssignmentTitle?: boolean;
  assignmentTitle?: string;
  isAssignmentSpecific?: boolean;
}

export function SubmissionHistory({ 
  submissions: passedSubmissions, 
  loading = false, 
  showAssignmentTitle = false, 
  assignmentTitle, 
  isAssignmentSpecific = false 
}: SubmissionHistoryProps) {
  const [expandedFeedbacks, setExpandedFeedbacks] = useState<Record<number, boolean>>({});
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Handle feedback ready notification
  const handleFeedbackReady = useCallback((submission: SubmissionWithFeedback) => {
    // Show toast notification
    toast({
      title: "Feedback Ready!",
      description: `Your assignment feedback is now available with a score of ${submission.feedback?.score}%.`,
      duration: 5000,
      action: (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => {
            const element = document.getElementById(`submission-${submission.id}`);
            element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
        >
          <Sparkles className="h-4 w-4 mr-1" />
          View
        </Button>
      ),
    });

    // Request notification permission and show browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Assignment Feedback Ready', {
        body: `Your submission received a score of ${submission.feedback?.score}%`,
        icon: '/favicon.ico'
      });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification('Assignment Feedback Ready', {
            body: `Your submission received a score of ${submission.feedback?.score}%`,
            icon: '/favicon.ico'
          });
        }
      });
    }
  }, [toast]);

  // Use real-time polling if we have a user ID, otherwise use passed submissions
  const shouldPoll = !!user?.id && !isAssignmentSpecific;
  const { 
    submissions: polledSubmissions, 
    isLoading: pollingLoading,
    hasProcessingSubmissions,
    refreshSubmissions
  } = useSubmissionPolling(user?.id || 0, {
    enabled: shouldPoll,
    onFeedbackReady: handleFeedbackReady
  });
  
  // Use polled submissions if available, otherwise use passed submissions
  const submissions = shouldPoll ? polledSubmissions : (passedSubmissions || []);
  const isLoading = shouldPoll ? pollingLoading : loading;
  
  // Initialize expanded state to only show the most recent submission expanded
  const initializeExpandedState = useCallback(() => {
    if (submissions.length > 0) {
      const mostRecentSubmissionId = submissions[0].id;
      setExpandedFeedbacks(prev => {
        // Only expand if not already set
        if (Object.keys(prev).length === 0) {
          return { [mostRecentSubmissionId]: true };
        }
        return prev;
      });
    }
  }, [submissions]);
  
  // Initialize expanded state when submissions change
  React.useEffect(() => {
    initializeExpandedState();
  }, [initializeExpandedState]);
  
  const toggleFeedback = (submissionId: number) => {
    setExpandedFeedbacks(prev => ({
      ...prev,
      [submissionId]: !prev[submissionId]
    }));
  };
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <History className="h-5 w-5" />
            <span>
              {isAssignmentSpecific ? `Submission History - ${assignmentTitle}` : 'Submission History'}
            </span>
            {hasProcessingSubmissions && (
              <div className="flex items-center space-x-1 text-blue-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm font-normal">Live Updates</span>
              </div>
            )}
          </CardTitle>
          <CardDescription>
            {hasProcessingSubmissions 
              ? 'Monitoring submissions in real-time for feedback updates...'
              : `Loading your ${isAssignmentSpecific ? 'submissions for this assignment' : 'previous submissions'}...`
            }
          </CardDescription>
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
          <CardTitle>
            {isAssignmentSpecific ? `Submission History - ${assignmentTitle}` : 'Submission History'}
          </CardTitle>
          <CardDescription>
            {isAssignmentSpecific 
              ? 'View your submissions and AI feedback for this assignment' 
              : 'View your previous submissions and AI feedback'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 text-center">
          <div className="flex flex-col items-center">
            <div className="mb-6 relative">
              <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center border border-indigo-100">
                <History className="h-8 w-8 text-indigo-500" />
              </div>
              <div className="absolute -top-2 -right-2 bg-primary rounded-full p-1.5 shadow-md animate-pulse">
                <AlertCircle className="h-4 w-4 text-white" />
              </div>
            </div>
            
            <h3 className="text-xl font-semibold text-neutral-800 mb-3">
              {isAssignmentSpecific ? 'No submissions for this assignment' : 'Your AI feedback journey starts here'}
            </h3>
            <p className="text-neutral-600 mb-6 max-w-md">
              {isAssignmentSpecific 
                ? 'You haven\'t submitted any work for this assignment yet. Submit your work above to receive detailed AI feedback and track your progress.'
                : 'Submit your first assignment to receive detailed AI feedback. All your submissions will be tracked here so you can see your progress over time.'
              }
            </p>
            
            <div className="w-full max-w-md bg-blue-50 rounded-md p-4 mb-5 text-left border border-blue-100">
              <h4 className="font-medium text-blue-800 mb-2 flex items-center">
                <CheckCircle className="h-4 w-4 mr-2" />
                How it works
              </h4>
              <ul className="text-sm text-blue-700 space-y-2 pl-6 list-disc">
                <li>Submit your assignment work (files, code, or text)</li>
                <li>Our AI analyzes your submission against the rubric</li>
                <li>Receive detailed, personalized feedback</li>
                <li>Track your improvements across multiple submissions</li>
              </ul>
            </div>
            
            <Button 
              onClick={() => navigate('/assignments')}
              className="inline-flex items-center justify-center px-6 h-11 bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-md hover:shadow-lg transition-all"
              size="lg"
            >
              <ArrowUpCircle className="mr-2 h-5 w-5" />
              Find assignments to submit
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <History className="h-5 w-5" />
            <span>
              {isAssignmentSpecific ? `Submission History - ${assignmentTitle}` : 'Submission History'}
            </span>
          </div>
          {hasProcessingSubmissions && (
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1 text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-xs font-medium">Live Updates</span>
              </div>
              <Button variant="ghost" size="sm" onClick={refreshSubmissions}>
                <ArrowUpCircle className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardTitle>
        <CardDescription>
          {hasProcessingSubmissions 
            ? 'Monitoring submissions in real-time for feedback updates'
            : isAssignmentSpecific 
              ? 'View your submissions and AI feedback for this assignment' 
              : 'View your previous submissions and AI feedback'
          }
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {Array.isArray(submissions) && submissions.map((submission: SubmissionWithFeedback, index: number) => (
          <div 
            key={submission.id}
            id={`submission-${submission.id}`}
            className={`${index < (Array.isArray(submissions) ? submissions.length : 0) - 1 ? 'border-b border-neutral-200 pb-4' : ''}`}
          >
            <RealTimeSubmissionCard 
              submission={submission}
              isLatest={index === 0}
              onFeedbackReady={() => {
                // Auto-scroll to the submission that just received feedback
                const element = document.getElementById(`submission-${submission.id}`);
                element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
