import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { FeedbackCard } from '@/components/ui/feedback-card';
import { SubmissionWithFeedback } from '@/lib/types';
import { formatDate } from '@/lib/utils/format';
import { 
  Loader2, CheckCircle, Clock, Sparkles, ArrowDown, RefreshCw, 
  FileText, File, Image, FileCode 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RealTimeSubmissionCardProps {
  submission: SubmissionWithFeedback;
  isLatest?: boolean;
  onFeedbackReady?: () => void;
}

// Helper function to get file icon
function getFileIcon(fileName?: string, mimeType?: string) {
  if (!fileName && !mimeType) return <FileText className="h-4 w-4" />;
  
  if (mimeType?.startsWith('image/')) {
    return <Image className="h-4 w-4 text-blue-600" />;
  } else if (fileName?.match(/\.(js|ts|py|java|c|cpp|html|css)$/)) {
    return <FileCode className="h-4 w-4 text-indigo-600" />;
  }
  
  return <File className="h-4 w-4 text-neutral-600" />;
}

export function RealTimeSubmissionCard({ 
  submission, 
  isLatest = false, 
  onFeedbackReady 
}: RealTimeSubmissionCardProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [animateProgress, setAnimateProgress] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  
  const isProcessing = submission.status === 'processing' || submission.status === 'pending';
  const isCompleted = submission.status === 'completed';
  const hasFeedback = !!submission.feedback;

  // Animate progress for processing submissions
  useEffect(() => {
    if (isProcessing) {
      setAnimateProgress(true);
      const timer = setTimeout(() => setAnimateProgress(false), 100);
      return () => clearTimeout(timer);
    }
  }, [isProcessing]);

  // Handle feedback completion
  useEffect(() => {
    if (isCompleted && hasFeedback && !justCompleted) {
      setJustCompleted(true);
      setShowFeedback(true);
      onFeedbackReady?.();
      
      // Reset the "just completed" state after animation
      const timer = setTimeout(() => setJustCompleted(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isCompleted, hasFeedback, justCompleted, onFeedbackReady]);

  return (
    <Card className={cn(
      "relative transition-all duration-300",
      isLatest && "ring-2 ring-primary/20 border-primary/30",
      justCompleted && "ring-2 ring-green-400 shadow-lg scale-[1.02]"
    )}>
      {/* Latest submission indicator */}
      {isLatest && (
        <div className="absolute -top-3 left-4 z-10">
          <Badge variant="default" className="bg-primary text-primary-foreground shadow-sm">
            Latest Submission
          </Badge>
        </div>
      )}

      {/* Just completed celebration */}
      {justCompleted && (
        <div className="absolute -top-2 -right-2 z-10 animate-bounce">
          <div className="bg-green-500 text-white rounded-full p-2 shadow-lg">
            <Sparkles className="h-4 w-4" />
          </div>
        </div>
      )}

      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            {getFileIcon(submission.fileName, submission.fileType)}
            <div>
              <h3 className="font-medium text-neutral-900">
                {submission.fileName || 'Code Submission'}
              </h3>
              <p className="text-sm text-neutral-600">
                {formatDate(submission.createdAt)}
              </p>
            </div>
          </div>
          
          {/* Status indicator */}
          <div className="flex items-center space-x-2">
            {isProcessing && (
              <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Processing
              </Badge>
            )}
            {isCompleted && hasFeedback && (
              <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                <CheckCircle className="h-3 w-3 mr-1" />
                Complete
              </Badge>
            )}
            {isCompleted && !hasFeedback && (
              <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">
                <Clock className="h-3 w-3 mr-1" />
                Pending
              </Badge>
            )}
          </div>
        </div>

        {/* Processing status */}
        {isProcessing && (
          <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                <span className="text-sm font-medium text-blue-900">
                  AI is analyzing your submission
                </span>
              </div>
            </div>
            
            {/* Animated progress bar */}
            <div className="space-y-2">
              <Progress 
                value={75} 
                className={cn(
                  "h-2 transition-all duration-500",
                  animateProgress && "animate-pulse"
                )}
              />
              <p className="text-xs text-blue-700">
                Evaluating code quality, functionality, and rubric criteria...
              </p>
            </div>
          </div>
        )}

        {/* Feedback section */}
        {hasFeedback && (
          <div className="space-y-3">
            {/* Quick feedback summary */}
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-900">
                  Feedback Ready
                </span>
                {submission.feedback?.score !== null && submission.feedback?.score !== undefined && (
                  <Badge variant="outline" className="bg-white">
                    {submission.feedback.score}%
                  </Badge>
                )}
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFeedback(!showFeedback)}
                className="text-green-700 hover:text-green-800 hover:bg-green-100"
              >
                {showFeedback ? 'Hide' : 'Show'} Details
                <ArrowDown className={cn(
                  "h-3 w-3 ml-1 transition-transform duration-200",
                  showFeedback && "rotate-180"
                )} />
              </Button>
            </div>

            {/* Detailed feedback */}
            {showFeedback && submission.feedback && (
              <div className="animate-in slide-in-from-top-2 duration-300">
                <FeedbackCard feedback={submission.feedback} />
              </div>
            )}
          </div>
        )}

        {/* Submission content preview */}
        {!isProcessing && submission.content && (
          <div className="mt-4 pt-4 border-t border-neutral-200">
            <p className="text-xs text-neutral-600 mb-2">Submission Content:</p>
            <div className="bg-neutral-50 rounded p-3 text-sm font-mono text-neutral-700 max-h-24 overflow-hidden">
              {submission.content.substring(0, 200)}
              {submission.content.length > 200 && '...'}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}