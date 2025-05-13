import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FeedbackCard } from "@/components/ui/feedback-card";
import { formatDate } from "@/lib/utils/format";
import { SubmissionWithFeedback } from "@/lib/types";
import { useState } from "react";
import { History, Loader2, ArrowUpCircle, FileText } from "lucide-react";
import { useLocation } from "wouter";

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
                <div className="bg-blue-50 rounded-lg p-4 mb-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium text-neutral-800">AI Feedback</h4>
                    <span className="text-xs text-blue-600 flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Processing...
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-2">Your feedback is being generated and will appear here shortly.</p>
                </div>
              ) : (
                <div className="bg-amber-50 rounded-lg p-4 mb-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium text-neutral-800">AI Feedback</h4>
                    <span className="text-xs text-amber-600 px-2 py-1 rounded-full bg-amber-100">
                      Feedback unavailable
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-2">There was an issue generating feedback for this submission.</p>
                </div>
              )
            )}
            
            {/* Submission File/Content Link */}
            <div className="bg-white border border-neutral-200 rounded-lg p-3 flex justify-between items-center">
              <div className="flex items-center">
                <FileText className="h-5 w-5 text-neutral-400 mr-2" />
                <span className="text-sm text-neutral-700">
                  {submission.fileName || 'Code submission'}
                </span>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-primary hover:text-primary-dark hover:bg-primary-50 transition-colors"
                onClick={() => {
                  // In a real implementation, this would download or view the submission
                  // For now, we'll just show the action with a toast
                  window.alert(`${submission.fileName ? 'Downloading' : 'Viewing'} submission: ${submission.fileName || 'Code content'}`);
                }}
              >
                <FileText className="h-4 w-4 mr-1" />
                {submission.fileName ? 'Download' : 'View'}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
